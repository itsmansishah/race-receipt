import "server-only";

import type { DB } from "./db";
import { ConfigError, productHandle } from "./env";
import { errorMessage, log } from "./log";
import {
  createReceipt,
  getReceipt,
  isReceiptId,
  newReceiptId,
  RECEIPT_ATTRIBUTE,
  setCheckout,
  updatePendingReceipt,
} from "./receipts";
import { saveDitheredPhoto } from "./storage";
import { createCart, getCatalog, refreshCheckoutUrl, ShopifyError } from "./shopify/storefront";
import { finishValue, SIZE_VALUES, variantKeyFor } from "../catalog";
import { mergeDraft } from "../persistence";
import type { ReceiptState } from "../receipt-state";

/** Error codes the customizer turns into friendly messages. The design is never lost. */
export type CheckoutErrorCode =
  | "invalid_design"
  | "out_of_stock"
  | "unavailable_option"
  | "already_paid"
  | "not_found"
  | "shopify_unavailable"
  | "not_configured";

type CheckoutFailure = { ok: false; code: CheckoutErrorCode; message: string; receiptId?: string };

export type CheckoutResult = { ok: true; receiptId: string; checkoutUrl: string } | CheckoutFailure;

const MESSAGES: Record<CheckoutErrorCode, string> = {
  invalid_design: "Something in the design needs a look before checkout.",
  out_of_stock: "That size and finish is sold out right now. Try another finish, or check back soon.",
  unavailable_option: "That size and finish isn't available to order yet. Try another combination.",
  already_paid: "This receipt has already been ordered. Start a new design to order another.",
  not_found: "We couldn't find that saved design.",
  shopify_unavailable: "Our checkout didn't respond. Please try again in a moment.",
  not_configured: "Checkout isn't set up yet.",
};

function fail(code: CheckoutErrorCode, receiptId?: string, message = MESSAGES[code]): CheckoutFailure {
  return { ok: false, code, message, receiptId };
}

/** Looks up the variant for the design's print options. */
async function resolveVariant(design: ReceiptState) {
  const catalog = await getCatalog(productHandle());
  return catalog.variants[variantKeyFor(design.print)] ?? null;
}

function handleError(err: unknown, receiptId?: string): CheckoutFailure {
  if (err instanceof ConfigError) {
    log.error("checkout.not_configured", { error: err.message });
    return fail("not_configured", receiptId);
  }
  log.error("checkout.failed", { receiptId, error: errorMessage(err), shopify: err instanceof ShopifyError });
  return fail("shopify_unavailable", receiptId);
}

/**
 * Saves the design, creates a Shopify cart for the matching variant with only
 * the receipt ID attached, and returns the hosted checkout URL.
 */
export async function startCheckout(
  db: DB,
  input: { design?: unknown; receiptId?: unknown },
  { buyerIp }: { buyerIp?: string | null } = {},
): Promise<CheckoutResult> {
  const design = mergeDraft(input.design);
  const rawPhoto = (input.design as { hero?: { photo?: { dataUrl?: unknown } } } | null)?.hero?.photo?.dataUrl;
  const photo = typeof rawPhoto === "string" ? rawPhoto : null;

  if (design.hero.kind === "photo" && !photo) {
    return fail("invalid_design", undefined, "Add your finish-line photo, or pick a course map or no image.");
  }
  if (design.giftFor === "friend" && !design.recipientName.trim()) {
    return fail("invalid_design", undefined, "Add the recipient's name so we can address the gift.");
  }

  // Reuse the receipt from an earlier attempt if it hasn't been paid.
  const existing = isReceiptId(input.receiptId) ? getReceipt(db, input.receiptId) : null;
  if (existing && existing.status !== "pending_payment") return fail("already_paid", existing.id);
  const receiptId = existing?.id ?? newReceiptId();

  try {
    const variant = await resolveVariant(design);
    if (!variant) return fail("unavailable_option", existing?.id);
    if (!variant.availableForSale) return fail("out_of_stock", existing?.id);

    const photoKey = design.hero.kind === "photo" && photo ? await saveDitheredPhoto(receiptId, photo) : null;
    const record = {
      design,
      photoKey,
      size: SIZE_VALUES[design.print.size],
      finish: finishValue(design.print.frame, design.print.frameColor),
    };
    if (existing) updatePendingReceipt(db, receiptId, record);
    else createReceipt(db, record, receiptId);

    const cart = await createCart({ variantId: variant.id, attributeKey: RECEIPT_ATTRIBUTE, receiptId }, { buyerIp });
    if (!cart.ok) {
      return cart.reason === "out_of_stock" ? fail("out_of_stock", receiptId) : fail("shopify_unavailable", receiptId);
    }
    setCheckout(db, receiptId, cart.cartId, cart.checkoutUrl);
    log.info("checkout.started", { receiptId, variant: variant.id });
    return { ok: true, receiptId, checkoutUrl: cart.checkoutUrl };
  } catch (err) {
    return handleError(err, existing?.id ?? (getReceipt(db, receiptId) ? receiptId : undefined));
  }
}

export type ResumeResult =
  | { ok: true; status: "paid"; orderName: string | null }
  | { ok: true; status: "pending"; checkoutUrl: string }
  | { ok: false; code: CheckoutErrorCode; message: string };

/** For a buyer coming back from an abandoned checkout: a fresh link, or "already paid". */
export async function resumeCheckout(
  db: DB,
  receiptId: unknown,
  { buyerIp }: { buyerIp?: string | null } = {},
): Promise<ResumeResult> {
  const receipt = isReceiptId(receiptId) ? getReceipt(db, receiptId) : null;
  if (!receipt) return { ok: false, code: "not_found", message: MESSAGES.not_found };
  if (receipt.status !== "pending_payment") return { ok: true, status: "paid", orderName: receipt.orderName };

  try {
    const url = receipt.cartId ? await refreshCheckoutUrl(receipt.cartId, { buyerIp }) : null;
    if (url) {
      setCheckout(db, receipt.id, receipt.cartId!, url);
      return { ok: true, status: "pending", checkoutUrl: url };
    }
    // The cart expired: build a new one from the saved design.
    const variant = await resolveVariant(receipt.design);
    if (!variant) return { ok: false, code: "unavailable_option", message: MESSAGES.unavailable_option };
    if (!variant.availableForSale) return { ok: false, code: "out_of_stock", message: MESSAGES.out_of_stock };
    const cart = await createCart({ variantId: variant.id, attributeKey: RECEIPT_ATTRIBUTE, receiptId: receipt.id }, { buyerIp });
    if (!cart.ok) {
      const code = cart.reason === "out_of_stock" ? "out_of_stock" : "shopify_unavailable";
      return { ok: false, code, message: MESSAGES[code] };
    }
    setCheckout(db, receipt.id, cart.cartId, cart.checkoutUrl);
    return { ok: true, status: "pending", checkoutUrl: cart.checkoutUrl };
  } catch (err) {
    const { code, message } = handleError(err, receipt.id);
    return { ok: false, code, message };
  }
}

export function buyerIpFrom(headers: Headers): string | null {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || null;
}
