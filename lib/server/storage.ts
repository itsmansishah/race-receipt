import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import { storageDir } from "./env";

// Local file storage. Keys are relative paths, so swapping in S3 or R2 later
// only changes this module.

function resolveKey(key: string): string {
  const root = path.resolve(storageDir());
  const full = path.resolve(root, key);
  if (!full.startsWith(root + path.sep)) throw new Error(`Invalid storage key: ${key}`);
  return full;
}

export async function putFile(key: string, data: Buffer | string): Promise<string> {
  const full = resolveKey(key);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, data);
  return key;
}

export async function getFile(key: string): Promise<Buffer> {
  return fs.readFile(resolveKey(key));
}

export async function deleteFile(key: string): Promise<void> {
  await fs.rm(resolveKey(key), { force: true });
}

export function absolutePath(key: string): string {
  return resolveKey(key);
}

const PNG_DATA_URL = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/;
const MAX_PHOTO_BYTES = 1_500_000;

/** Stores the dithered photo (never the original). Returns its key. */
export async function saveDitheredPhoto(receiptId: string, dataUrl: string): Promise<string> {
  const match = PNG_DATA_URL.exec(dataUrl);
  if (!match) throw new Error("Photo must be a PNG data URL");
  const bytes = Buffer.from(match[1], "base64");
  if (bytes.length > MAX_PHOTO_BYTES) throw new Error("Photo is too large");
  if (bytes.subarray(1, 4).toString("ascii") !== "PNG") throw new Error("Photo is not a PNG");
  return putFile(`photos/${receiptId}.png`, bytes);
}

export async function photoDataUrl(key: string): Promise<string> {
  const bytes = await getFile(key);
  return `data:image/png;base64,${bytes.toString("base64")}`;
}
