// Exercises the paid-order pipeline without Shopify: saves a receipt, then
// sends a correctly signed fake orders/paid webhook to the local server.
//   npm run simulate:paid              # new receipt from the default design, 11x14
//   npm run simulate:paid -- 8x10      # pick the print size
//   npm run simulate:paid -- 8x10 dup  # also send the same delivery twice
import "./load-env";
import { createHmac, randomUUID } from "node:crypto";
import { getDb } from "@/lib/server/db";
import { siteUrl, webhookSecret } from "@/lib/server/env";
import { createReceipt } from "@/lib/server/receipts";
import { finishValue, SIZE_VALUES } from "@/lib/catalog";
import { createInitialState, type PrintSize } from "@/lib/receipt-state";

async function main() {
  const size = (process.argv[2] ?? "11x14") as PrintSize;
  if (!(size in SIZE_VALUES)) throw new Error(`Unknown size ${size}`);
  const design = createInitialState();
  design.print.size = size;
  design.recipientName = "Sam Recipient";
  design.giftMessage = "26.2 miles of proud. Love, J";

  const receiptId = createReceipt(getDb(), {
    design,
    photoKey: null,
    size: SIZE_VALUES[size],
    finish: finishValue(design.print.frame, design.print.frameColor),
  });

  const order = {
    id: Date.now(),
    name: "#SIM-" + receiptId.slice(-4),
    email: "buyer@example.com",
    shipping_address: { name: "Sam Recipient", address1: "1 Lake Shore Dr", city: "Chicago", province: "Illinois", zip: "60601", country: "United States" },
    line_items: [{ properties: [{ name: "_receipt_id", value: receiptId }] }],
    note_attributes: [],
  };
  const body = JSON.stringify(order);
  const headers = {
    "Content-Type": "application/json",
    "X-Shopify-Topic": "orders/paid",
    "X-Shopify-Webhook-Id": randomUUID(),
    "X-Shopify-Hmac-SHA256": createHmac("sha256", webhookSecret()).update(body).digest("base64"),
  };
  const url = `${siteUrl()}/api/webhooks/shopify/orders-paid`;
  const send = async () => {
    const res = await fetch(url, { method: "POST", headers, body });
    console.log(`POST ${url} → ${res.status} ${await res.text()}`);
  };
  console.log(`Receipt ${receiptId} (${size})`);
  await send();
  if (process.argv[3] === "dup") await send();
  console.log("Now watch the worker log for render.done, then look in storage/prints/.");
}

main().catch((err) => {
  console.error(`✗ ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
