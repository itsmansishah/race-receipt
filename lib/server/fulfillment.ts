import "server-only";

import { log } from "./log";
import type { Receipt, ShippingAddress } from "./receipts";

/** Everything the packer and the label need. Gift orders ship to the recipient and never show prices. */
export interface PackingSlip {
  receiptId: string;
  orderName: string | null;
  isGift: boolean;
  shipTo: ShippingAddress | null;
  /** For gifts, the recipient's name from our customizer (falls back to the shipping name). */
  attention: string | null;
  giftMessage: string | null;
  /** Buyer contact, for shipping notifications. Not printed on gift slips. */
  buyerEmail: string | null;
  item: { title: string; size: string; finish: string };
  printFileKey: string;
}

export function buildPackingSlip(receipt: Receipt, printFileKey: string): PackingSlip {
  return {
    receiptId: receipt.id,
    orderName: receipt.orderName,
    isGift: receipt.isGift,
    // Shopify's checkout collects the shipping address; for gifts the buyer enters the recipient's.
    shipTo: receipt.shippingAddress,
    attention: receipt.isGift ? (receipt.recipientName ?? receipt.shippingAddress?.name ?? null) : receipt.shippingAddress?.name ?? null,
    giftMessage: receipt.isGift ? receipt.giftMessage : null,
    buyerEmail: receipt.buyerEmail,
    item: { title: `Race Receipt: ${receipt.design.raceTitle}`, size: receipt.size, finish: receipt.finish },
    printFileKey,
  };
}

/** Plain-text slip for a human packer. */
export function packingSlipText(slip: PackingSlip): string {
  const a = slip.shipTo;
  const lines = [
    `RACE RECEIPT · ${slip.orderName ?? slip.receiptId}`,
    slip.isGift ? "GIFT ORDER: no prices, include gift card" : "",
    "",
    "SHIP TO",
    ...(slip.attention ? [slip.attention] : []),
    a?.address1 ?? "(no shipping address on order)",
    ...(a?.address2 ? [a.address2] : []),
    [a?.city, a?.province, a?.zip].filter(Boolean).join(", "),
    a?.country ?? "",
    "",
    `ITEM  ${slip.item.title}`,
    `      ${slip.item.size} · ${slip.item.finish}`,
    `FILE  ${slip.printFileKey}`,
  ];
  if (slip.giftMessage) lines.push("", "GIFT CARD", slip.giftMessage);
  return lines.filter((l, i, all) => l !== "" || all[i - 1] !== "").join("\n") + "\n";
}

// ============================================================================
// STUB: fulfillment hand-off. Not connected to anything yet.
//
// When a fulfillment method is chosen (print lab API, print-on-demand
// partner, or printing in-house), replace this function so it sends the
// print file and the packing slip, and returns the partner's reference.
// Until then it only logs, and receipts wait at "awaiting_fulfillment".
// ============================================================================
export async function submitForFulfillment(slip: PackingSlip): Promise<{ submitted: false; reason: string }> {
  log.info("fulfillment.stub", {
    receiptId: slip.receiptId,
    orderName: slip.orderName,
    note: "No fulfillment method configured; order is waiting at awaiting_fulfillment.",
  });
  return { submitted: false, reason: "fulfillment not configured" };
}
