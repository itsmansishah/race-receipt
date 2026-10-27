import { createHmac } from "node:crypto";
import { openDb } from "@/lib/server/db";
import { createReceipt } from "@/lib/server/receipts";
import { createInitialState } from "@/lib/receipt-state";
import type { PaidOrder } from "@/lib/server/receipts";

export const SECRET = "test-client-secret";

export function freshDb() {
  return openDb(":memory:");
}

export function saveReceipt(db: ReturnType<typeof freshDb>, overrides: Partial<ReturnType<typeof createInitialState>> = {}) {
  const design = { ...createInitialState(), ...overrides };
  return createReceipt(db, { design, photoKey: null, size: "11x14", finish: "Black frame + mat" });
}

export function paidOrder(receiptId: string, extra: Partial<PaidOrder> = {}): PaidOrder {
  return {
    id: 5_550_001,
    name: "#1001",
    email: "buyer@example.com",
    shipping_address: { name: "Sam Recipient", address1: "1 Lake Shore Dr", city: "Chicago", province: "Illinois", zip: "60601", country: "United States" },
    line_items: [{ properties: [{ name: "_receipt_id", value: receiptId }] }],
    note_attributes: [],
    ...extra,
  };
}

export function webhookRequest(order: unknown, { webhookId = "wh-1", topic = "orders/paid", secret = SECRET } = {}) {
  const rawBody = Buffer.from(JSON.stringify(order));
  const headers = new Headers({
    "x-shopify-hmac-sha256": createHmac("sha256", secret).update(rawBody).digest("base64"),
    "x-shopify-webhook-id": webhookId,
    "x-shopify-topic": topic,
    "x-shopify-shop-domain": "race-receipt-dev.myshopify.com",
  });
  return { rawBody, headers };
}
