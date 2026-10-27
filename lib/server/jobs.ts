import "server-only";

import type { DB } from "./db";
import { nowIso } from "./db";

// A small database-backed job queue. The webhook enqueues; scripts/worker.ts
// claims and runs jobs. No Redis needed for a single worker.

export type JobType = "render_print";

export interface Job {
  id: number;
  type: JobType;
  receipt_id: string;
  status: "queued" | "running" | "done" | "failed";
  attempts: number;
  last_error: string | null;
}

export const MAX_ATTEMPTS = 5;

/** Queues a job once per (type, receipt). Returns false if it was already queued. */
export function enqueueJob(db: DB, type: JobType, receiptId: string): boolean {
  const result = db.prepare(`INSERT OR IGNORE INTO jobs (type, receipt_id) VALUES (?, ?)`).run(type, receiptId);
  return result.changes === 1;
}

/** Atomically claims the next runnable job. */
export function claimNextJob(db: DB): Job | null {
  const now = nowIso();
  const row = db
    .prepare(
      `UPDATE jobs SET status='running', attempts=attempts+1, updated_at=@now
       WHERE id = (SELECT id FROM jobs WHERE status='queued' AND run_after <= @now ORDER BY id LIMIT 1)
       RETURNING *`,
    )
    .get({ now }) as Job | undefined;
  return row ?? null;
}

export function completeJob(db: DB, id: number) {
  db.prepare(`UPDATE jobs SET status='done', last_error=NULL, updated_at=? WHERE id=?`).run(nowIso(), id);
}

/** Retries with exponential backoff (30 s, 1 min, 2 min, …) until MAX_ATTEMPTS, then fails for good. */
export function failJob(db: DB, job: Job, error: string): "retrying" | "failed" {
  if (job.attempts >= MAX_ATTEMPTS) {
    db.prepare(`UPDATE jobs SET status='failed', last_error=?, updated_at=? WHERE id=?`).run(error, nowIso(), job.id);
    return "failed";
  }
  const delayMs = 30_000 * 2 ** (job.attempts - 1);
  db.prepare(`UPDATE jobs SET status='queued', last_error=?, run_after=?, updated_at=? WHERE id=?`).run(
    error,
    new Date(Date.now() + delayMs).toISOString(),
    nowIso(),
    job.id,
  );
  return "retrying";
}

/** Jobs left "running" by a crashed worker go back in the queue. */
export function requeueStuckJobs(db: DB, olderThanMs = 10 * 60_000): number {
  const cutoff = new Date(Date.now() - olderThanMs).toISOString();
  return db
    .prepare(`UPDATE jobs SET status='queued', updated_at=? WHERE status='running' AND updated_at < ?`)
    .run(nowIso(), cutoff).changes;
}

export function countJobs(db: DB, receiptId: string): number {
  return (db.prepare(`SELECT COUNT(*) AS n FROM jobs WHERE receipt_id=?`).get(receiptId) as { n: number }).n;
}
