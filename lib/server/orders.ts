import "server-only";

import type { DB } from "./db";
import { enqueueJob } from "./jobs";
import { log } from "./log";
import { claimReceiptForOrder, receiptIdsFromOrder, type ClaimResult, type PaidOrder } from "./receipts";
import { verifyShopifyHmac } from "./shopify/hmac";

export interface OrderOutcome {
  receiptIds: string[];
  claims: Record<string, ClaimResult>;
  renderQueued: string[];
}

/**
 * Marks each receipt in a paid order as paid and queues its print render.
 * Idempotent: a second call for the same order queues nothing new.
 */
export function processPaidOrder(db: DB, order: PaidOrder): OrderOutcome {
  const receiptIds = receiptIdsFromOrder(order);
  const claims: Record<string, ClaimResult> = {};
  const renderQueued: string[] = [];
  for (const id of receiptIds) {
    const claim = claimReceiptForOrder(db, id, order);
    claims[id] = claim;
    if ((claim === "claimed" || claim === "already_claimed") && enqueueJob(db, "render_print", id)) {
      renderQueued.push(id);
    }
  }
  return { receiptIds, claims, renderQueued };
}

export interface WebhookRequest {
  rawBody: Buffer;
  headers: Headers;
}

export interface WebhookResponse {
  status: number;
  body: Record<string, unknown>;
}

/**
 * orders/paid handler. Only fast, synchronous database work happens here so
 * Shopify gets its 200 well inside the 5-second limit; rendering runs in the worker.
 */
export function handleOrdersPaidWebhook(db: DB, secret: string, req: WebhookRequest): WebhookResponse {
  const hmac = req.headers.get("x-shopify-hmac-sha256");
  const webhookId = req.headers.get("x-shopify-webhook-id");
  const topic = req.headers.get("x-shopify-topic");
  const shop = req.headers.get("x-shopify-shop-domain");

  if (!verifyShopifyHmac(req.rawBody, hmac, secret)) {
    log.warn("webhook.rejected_hmac", { webhookId, topic, shop, hasHeader: Boolean(hmac) });
    return { status: 401, body: { error: "invalid signature" } };
  }
  if (!webhookId) {
    log.error("webhook.missing_id", { topic, shop });
    return { status: 400, body: { error: "missing X-Shopify-Webhook-Id" } };
  }
  if (topic !== "orders/paid") {
    log.warn("webhook.unexpected_topic", { webhookId, topic, shop });
    return { status: 200, body: { ignored: true } };
  }

  let order: PaidOrder;
  try {
    order = JSON.parse(req.rawBody.toString("utf8"));
  } catch {
    log.error("webhook.bad_json", { webhookId });
    return { status: 400, body: { error: "invalid JSON" } };
  }

  try {
    // One transaction: if anything throws, the delivery isn't recorded and Shopify's retry is processed afresh.
    return db.transaction((): WebhookResponse => {
      const inserted = db
        .prepare(`INSERT OR IGNORE INTO webhook_deliveries (webhook_id, topic, order_id, status) VALUES (?, ?, ?, 'processing')`)
        .run(webhookId, topic, String(order.id));
      if (inserted.changes === 0) {
        log.info("webhook.duplicate", { webhookId, orderId: order.id });
        return { status: 200, body: { duplicate: true } };
      }

      const outcome = processPaidOrder(db, order);
      const problems = Object.entries(outcome.claims).filter(([, c]) => c === "not_found" || c === "claimed_by_other_order");
      const status = outcome.receiptIds.length === 0 ? "ignored" : problems.length ? "failed" : "processed";
      const error =
        outcome.receiptIds.length === 0
          ? "no _receipt_id on order"
          : problems.length
            ? problems.map(([id, c]) => `${id}: ${c}`).join("; ")
            : null;

      db.prepare(`UPDATE webhook_deliveries SET status=?, error=?, receipt_id=? WHERE webhook_id=?`).run(
        status,
        error,
        outcome.receiptIds.join(",") || null,
        webhookId,
      );

      // Retrying won't fix a missing receipt, so acknowledge, but make it loud.
      if (status === "failed") log.error("webhook.receipt_problem", { webhookId, orderId: order.id, error });
      else if (status === "ignored") log.warn("webhook.no_receipt_id", { webhookId, orderId: order.id, name: order.name });
      else log.info("webhook.processed", { webhookId, orderId: order.id, ...outcome });

      return { status: 200, body: { ok: true, receipts: outcome.receiptIds, queued: outcome.renderQueued } };
    })();
  } catch (err) {
    log.error("webhook.processing_failed", { webhookId, orderId: order.id, error: String(err) });
    return { status: 500, body: { error: "processing failed" } };
  }
}
