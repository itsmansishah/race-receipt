import "server-only";

import type { DB } from "./db";
import { nowIso } from "./db";
import { buildPackingSlip, packingSlipText, submitForFulfillment } from "./fulfillment";
import { claimNextJob, completeJob, failJob, type Job } from "./jobs";
import { errorMessage, log } from "./log";
import { getReceipt, setStatus } from "./receipts";
import { pngSize, printPixels, renderPrint } from "./render";
import { deleteFile, putFile } from "./storage";
import type { PrintSize } from "../receipt-state";

const DONE_STATUSES = new Set(["rendered", "awaiting_fulfillment"]);

async function runRenderJob(db: DB, job: Job) {
  const receipt = getReceipt(db, job.receipt_id);
  if (!receipt) throw new Error(`Receipt ${job.receipt_id} not found`);
  if (DONE_STATUSES.has(receipt.status)) return; // already printed: never twice
  if (receipt.status === "pending_payment") throw new Error("Receipt is not paid");

  setStatus(db, receipt.id, "rendering", { error: null });
  const size = receipt.design.print.size as PrintSize;
  const png = await renderPrint(receipt.id, size);
  const expected = printPixels(size);
  const actual = pngSize(png);
  if (actual.width !== expected.width || actual.height !== expected.height) {
    throw new Error(`Print file is ${actual.width}×${actual.height}, expected ${expected.width}×${expected.height}`);
  }
  const printKey = await putFile(`prints/${receipt.id}.png`, png);
  setStatus(db, receipt.id, "rendered", { render_key: printKey, rendered_at: nowIso() });
  log.info("render.done", { receiptId: receipt.id, ...actual, printKey });

  const slip = buildPackingSlip({ ...receipt, renderKey: printKey }, printKey);
  await putFile(`packing-slips/${receipt.id}.json`, JSON.stringify(slip, null, 2));
  await putFile(`packing-slips/${receipt.id}.txt`, packingSlipText(slip));

  await submitForFulfillment(slip); // STUB
  setStatus(db, receipt.id, "awaiting_fulfillment");
}

/** Runs one job if any is due. Returns false when the queue is empty. */
export async function runNextJob(db: DB): Promise<boolean> {
  const job = claimNextJob(db);
  if (!job) return false;
  try {
    if (job.type === "render_print") await runRenderJob(db, job);
    completeJob(db, job.id);
  } catch (err) {
    const message = errorMessage(err);
    const outcome = failJob(db, job, message);
    log.error("job.failed", { jobId: job.id, type: job.type, receiptId: job.receipt_id, attempt: job.attempts, outcome, error: message });
    if (outcome === "failed") setStatus(db, job.receipt_id, "render_failed", { error: message });
  }
  return true;
}

export const PHOTO_RETENTION_DAYS = 90;

/** Deletes dithered photos 90 days after an order was fulfilled. */
export async function purgeExpiredPhotos(db: DB, now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - PHOTO_RETENTION_DAYS * 86_400_000).toISOString();
  const rows = db
    .prepare(`SELECT id, photo_key FROM receipts WHERE photo_key IS NOT NULL AND fulfilled_at IS NOT NULL AND fulfilled_at < ?`)
    .all(cutoff) as { id: string; photo_key: string }[];
  for (const row of rows) {
    await deleteFile(row.photo_key);
    db.prepare(`UPDATE receipts SET photo_key=NULL, photo_deleted_at=? WHERE id=?`).run(nowIso(), row.id);
  }
  if (rows.length) log.info("photos.purged", { count: rows.length });
  return rows.length;
}
