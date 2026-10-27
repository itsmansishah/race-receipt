import "server-only";

import { randomBytes } from "node:crypto";
import type { DB } from "./db";
import { nowIso } from "./db";
import { mergeDraft } from "../persistence";
import type { ReceiptState } from "../receipt-state";

export type ReceiptStatus =
  | "pending_payment"
  | "paid"
  | "rendering"
  | "rendered"
  | "awaiting_fulfillment"
  | "render_failed";

export interface ShippingAddress {
  name: string | null;
  address1: string | null;
  address2: string | null;
  city: string | null;
  province: string | null;
  zip: string | null;
  country: string | null;
  phone: string | null;
}

export interface Receipt {
  id: string;
  status: ReceiptStatus;
  design: ReceiptState;
  photoKey: string | null;
  size: string;
  finish: string;
  isGift: boolean;
  recipientName: string | null;
  giftMessage: string | null;
  cartId: string | null;
  checkoutUrl: string | null;
  shopifyOrderId: string | null;
  orderName: string | null;
  buyerEmail: string | null;
  shippingAddress: ShippingAddress | null;
  renderKey: string | null;
  error: string | null;
  paidAt: string | null;
  createdAt: string;
}

/** The custom attribute key carried on the cart line. Leading underscore keeps it out of the buyer's view. */
export const RECEIPT_ATTRIBUTE = "_receipt_id";

const ID_PATTERN = /^rr_[A-Za-z0-9_-]{22}$/;

/** Unguessable, URL-safe receipt ID: "rr_" + 128 random bits. */
export function newReceiptId(): string {
  return `rr_${randomBytes(16).toString("base64url")}`;
}

export function isReceiptId(value: unknown): value is string {
  return typeof value === "string" && ID_PATTERN.test(value);
}

interface Row {
  id: string;
  status: ReceiptStatus;
  design: string;
  photo_key: string | null;
  size: string;
  finish: string;
  is_gift: number;
  recipient_name: string | null;
  gift_message: string | null;
  cart_id: string | null;
  checkout_url: string | null;
  shopify_order_id: string | null;
  order_name: string | null;
  buyer_email: string | null;
  shipping_address: string | null;
  render_key: string | null;
  error: string | null;
  paid_at: string | null;
  created_at: string;
}

function fromRow(row: Row): Receipt {
  return {
    id: row.id,
    status: row.status,
    design: mergeDraft(JSON.parse(row.design)),
    photoKey: row.photo_key,
    size: row.size,
    finish: row.finish,
    isGift: row.is_gift === 1,
    recipientName: row.recipient_name,
    giftMessage: row.gift_message,
    cartId: row.cart_id,
    checkoutUrl: row.checkout_url,
    shopifyOrderId: row.shopify_order_id,
    orderName: row.order_name,
    buyerEmail: row.buyer_email,
    shippingAddress: row.shipping_address ? JSON.parse(row.shipping_address) : null,
    renderKey: row.render_key,
    error: row.error,
    paidAt: row.paid_at,
    createdAt: row.created_at,
  };
}

export interface ReceiptInput {
  design: ReceiptState;
  photoKey: string | null;
  size: string;
  finish: string;
}

function designColumns(input: ReceiptInput) {
  // The photo lives in storage; the stored design never carries image data.
  const design: ReceiptState = { ...input.design, hero: { ...input.design.hero, photo: null } };
  const gift = design.giftFor === "friend";
  return {
    design: JSON.stringify(design),
    photo_key: input.photoKey,
    size: input.size,
    finish: input.finish,
    is_gift: gift ? 1 : 0,
    recipient_name: gift ? design.recipientName.trim() || null : null,
    gift_message: gift ? design.giftMessage.trim() || null : null,
  };
}

export function createReceipt(db: DB, input: ReceiptInput, id = newReceiptId()): string {
  db.prepare(
    `INSERT INTO receipts (id, design, photo_key, size, finish, is_gift, recipient_name, gift_message)
     VALUES (@id, @design, @photo_key, @size, @finish, @is_gift, @recipient_name, @gift_message)`,
  ).run({ id, ...designColumns(input) });
  return id;
}

/** Replaces the design of an unpaid receipt (retrying checkout). Returns false once it's been paid. */
export function updatePendingReceipt(db: DB, id: string, input: ReceiptInput): boolean {
  const result = db
    .prepare(
      `UPDATE receipts SET design=@design, photo_key=@photo_key, size=@size, finish=@finish, is_gift=@is_gift,
         recipient_name=@recipient_name, gift_message=@gift_message, updated_at=@now
       WHERE id=@id AND status='pending_payment'`,
    )
    .run({ id, now: nowIso(), ...designColumns(input) });
  return result.changes === 1;
}

export function getReceipt(db: DB, id: string): Receipt | null {
  if (!isReceiptId(id)) return null;
  const row = db.prepare(`SELECT * FROM receipts WHERE id = ?`).get(id) as Row | undefined;
  return row ? fromRow(row) : null;
}

export function setCheckout(db: DB, id: string, cartId: string, checkoutUrl: string) {
  db.prepare(`UPDATE receipts SET cart_id=?, checkout_url=?, updated_at=? WHERE id=?`).run(
    cartId,
    checkoutUrl,
    nowIso(),
    id,
  );
}

export function setStatus(
  db: DB,
  id: string,
  status: ReceiptStatus,
  fields: Partial<{ render_key: string; error: string | null; rendered_at: string; fulfilled_at: string }> = {},
) {
  const sets = ["status=@status", "updated_at=@now", ...Object.keys(fields).map((k) => `${k}=@${k}`)];
  db.prepare(`UPDATE receipts SET ${sets.join(", ")} WHERE id=@id`).run({ id, status, now: nowIso(), ...fields });
}

// ---- Orders ---------------------------------------------------------------

/** The parts of an orders/paid payload we rely on. */
export interface PaidOrder {
  id: number | string;
  name?: string;
  email?: string | null;
  contact_email?: string | null;
  shipping_address?: Record<string, unknown> | null;
  note_attributes?: { name: string; value: unknown }[];
  line_items?: { properties?: { name: string; value: unknown }[] | null }[];
}

/**
 * Finds every receipt ID in an order. The ID rides on the cart line, so it
 * arrives as a line item property; a cart-level attribute is accepted too.
 */
export function receiptIdsFromOrder(order: PaidOrder): string[] {
  const ids = new Set<string>();
  for (const line of order.line_items ?? []) {
    for (const prop of line.properties ?? []) {
      if (prop.name === RECEIPT_ATTRIBUTE && isReceiptId(prop.value)) ids.add(prop.value);
    }
  }
  for (const attr of order.note_attributes ?? []) {
    if (attr.name === RECEIPT_ATTRIBUTE && isReceiptId(attr.value)) ids.add(attr.value);
  }
  return [...ids];
}

function pickAddress(raw: Record<string, unknown> | null | undefined): ShippingAddress | null {
  if (!raw) return null;
  const s = (k: string) => (typeof raw[k] === "string" && raw[k] ? (raw[k] as string) : null);
  return {
    name: s("name"),
    address1: s("address1"),
    address2: s("address2"),
    city: s("city"),
    province: s("province"),
    zip: s("zip"),
    country: s("country"),
    phone: s("phone"),
  };
}

export type ClaimResult = "claimed" | "already_claimed" | "not_found" | "claimed_by_other_order";

/** Marks a receipt paid by this order. Safe to call repeatedly for the same order. */
export function claimReceiptForOrder(db: DB, receiptId: string, order: PaidOrder): ClaimResult {
  const receipt = getReceipt(db, receiptId);
  if (!receipt) return "not_found";
  const orderId = String(order.id);
  if (receipt.shopifyOrderId === orderId) return "already_claimed";
  if (receipt.shopifyOrderId) return "claimed_by_other_order";

  db.prepare(
    `UPDATE receipts SET status='paid', shopify_order_id=@orderId, order_name=@name, buyer_email=@email,
       shipping_address=@address, paid_at=@now, updated_at=@now
     WHERE id=@id AND shopify_order_id IS NULL`,
  ).run({
    id: receiptId,
    orderId,
    name: order.name ?? null,
    email: order.email ?? order.contact_email ?? null,
    address: JSON.stringify(pickAddress(order.shipping_address)),
    now: nowIso(),
  });
  return "claimed";
}
