import "server-only";

import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { databasePath } from "./env";

export type DB = Database.Database;

// Local-first storage: one SQLite file. The schema is plain SQL so it ports
// to Postgres when we pick a host.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS receipts (
  id                TEXT PRIMARY KEY,
  status            TEXT NOT NULL DEFAULT 'pending_payment',
  design            TEXT NOT NULL,             -- JSON ReceiptState, photo excluded
  photo_key         TEXT,                      -- dithered photo in storage, if any
  size              TEXT NOT NULL,
  finish            TEXT NOT NULL,             -- Shopify "Finish" option value
  is_gift           INTEGER NOT NULL DEFAULT 0,
  recipient_name    TEXT,
  gift_message      TEXT,
  cart_id           TEXT,
  checkout_url      TEXT,
  shopify_order_id  TEXT,                      -- set once, by the first paid order that claims it
  order_name        TEXT,
  buyer_email       TEXT,
  shipping_address  TEXT,                      -- JSON copied from the paid order
  render_key        TEXT,
  error             TEXT,
  paid_at           TEXT,
  rendered_at       TEXT,
  fulfilled_at      TEXT,
  photo_deleted_at  TEXT,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  webhook_id   TEXT PRIMARY KEY,               -- X-Shopify-Webhook-Id: same across retries
  topic        TEXT NOT NULL,
  order_id     TEXT,
  receipt_id   TEXT,
  status       TEXT NOT NULL,                  -- processed | ignored | failed
  error        TEXT,
  received_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS jobs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  type        TEXT NOT NULL,
  receipt_id  TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'queued',  -- queued | running | done | failed
  attempts    INTEGER NOT NULL DEFAULT 0,
  run_after   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  last_error  TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (type, receipt_id)                     -- a receipt is rendered once, however many deliveries arrive
);

CREATE INDEX IF NOT EXISTS jobs_queue ON jobs (status, run_after);
CREATE INDEX IF NOT EXISTS receipts_order ON receipts (shopify_order_id);
`;

export function openDb(file: string): DB {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL"); // the web server and the worker share the file
  db.pragma("busy_timeout = 5000");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  return db;
}

const globalForDb = globalThis as unknown as { raceReceiptDb?: DB };

/** Shared connection, reused across hot reloads in development. */
export function getDb(): DB {
  globalForDb.raceReceiptDb ??= openDb(databasePath());
  return globalForDb.raceReceiptDb;
}

export function nowIso(): string {
  return new Date().toISOString();
}
