import { describe, expect, it, vi } from "vitest";
import { countJobs } from "@/lib/server/jobs";
import { handleOrdersPaidWebhook } from "@/lib/server/orders";
import { getReceipt } from "@/lib/server/receipts";
import { freshDb, paidOrder, saveReceipt, SECRET, webhookRequest } from "./helpers";

vi.spyOn(console, "log").mockImplementation(() => {});
vi.spyOn(console, "warn").mockImplementation(() => {});
vi.spyOn(console, "error").mockImplementation(() => {});

const deliveries = (db: ReturnType<typeof freshDb>) =>
  db.prepare("SELECT webhook_id, status, error FROM webhook_deliveries").all() as { webhook_id: string; status: string; error: string | null }[];

describe("orders/paid webhook", () => {
  it("marks the receipt paid, copies the shipping address and queues one render", () => {
    const db = freshDb();
    const id = saveReceipt(db, { giftFor: "friend", recipientName: "Sam", giftMessage: "Proud of you" });
    const res = handleOrdersPaidWebhook(db, SECRET, webhookRequest(paidOrder(id)));

    expect(res.status).toBe(200);
    const receipt = getReceipt(db, id)!;
    expect(receipt.status).toBe("paid");
    expect(receipt.shopifyOrderId).toBe("5550001");
    expect(receipt.orderName).toBe("#1001");
    expect(receipt.shippingAddress?.address1).toBe("1 Lake Shore Dr");
    expect(receipt.recipientName).toBe("Sam");
    expect(receipt.giftMessage).toBe("Proud of you");
    expect(countJobs(db, id)).toBe(1);
  });

  it("ignores a redelivery with the same webhook ID", () => {
    const db = freshDb();
    const id = saveReceipt(db);
    const req = webhookRequest(paidOrder(id), { webhookId: "wh-same" });

    const first = handleOrdersPaidWebhook(db, SECRET, req);
    const second = handleOrdersPaidWebhook(db, SECRET, req);

    expect(first.status).toBe(200);
    expect(second).toEqual({ status: 200, body: { duplicate: true } });
    expect(countJobs(db, id)).toBe(1);
    expect(deliveries(db)).toHaveLength(1);
  });

  it("never queues a second render for the same order under a different webhook ID", () => {
    const db = freshDb();
    const id = saveReceipt(db);
    handleOrdersPaidWebhook(db, SECRET, webhookRequest(paidOrder(id), { webhookId: "wh-a" }));
    const again = handleOrdersPaidWebhook(db, SECRET, webhookRequest(paidOrder(id), { webhookId: "wh-b" }));

    expect(again.status).toBe(200);
    expect(again.body.queued).toEqual([]);
    expect(countJobs(db, id)).toBe(1);
    expect(deliveries(db).map((d) => d.status)).toEqual(["processed", "processed"]);
  });

  it("refuses to let a different order claim an already-paid receipt", () => {
    const db = freshDb();
    const id = saveReceipt(db);
    handleOrdersPaidWebhook(db, SECRET, webhookRequest(paidOrder(id), { webhookId: "wh-1" }));
    handleOrdersPaidWebhook(db, SECRET, webhookRequest(paidOrder(id, { id: 999 }), { webhookId: "wh-2" }));

    expect(getReceipt(db, id)!.shopifyOrderId).toBe("5550001");
    expect(countJobs(db, id)).toBe(1);
    expect(deliveries(db).find((d) => d.webhook_id === "wh-2")?.status).toBe("failed");
  });

  it("rejects a bad signature before touching the database", () => {
    const db = freshDb();
    const id = saveReceipt(db);
    const res = handleOrdersPaidWebhook(db, SECRET, webhookRequest(paidOrder(id), { secret: "wrong" }));

    expect(res.status).toBe(401);
    expect(getReceipt(db, id)!.status).toBe("pending_payment");
    expect(deliveries(db)).toHaveLength(0);
  });

  it("requires the webhook ID header", () => {
    const db = freshDb();
    const req = webhookRequest(paidOrder(saveReceipt(db)));
    req.headers.delete("x-shopify-webhook-id");
    expect(handleOrdersPaidWebhook(db, SECRET, req).status).toBe(400);
  });

  it("acknowledges but records an order with an unknown receipt ID, so it isn't silent", () => {
    const db = freshDb();
    const res = handleOrdersPaidWebhook(db, SECRET, webhookRequest(paidOrder("rr_AAAAAAAAAAAAAAAAAAAAAA")));

    expect(res.status).toBe(200);
    expect(deliveries(db)[0]).toMatchObject({ status: "failed" });
    expect(console.error).toHaveBeenCalled();
  });

  it("returns 500 (so Shopify retries) and records nothing if processing throws", () => {
    const db = freshDb();
    const id = saveReceipt(db);
    db.exec("DROP TABLE jobs"); // simulate a database failure mid-transaction
    const res = handleOrdersPaidWebhook(db, SECRET, webhookRequest(paidOrder(id)));

    expect(res.status).toBe(500);
    expect(deliveries(db)).toHaveLength(0);
    expect(getReceipt(db, id)!.status).toBe("pending_payment");
  });
});
