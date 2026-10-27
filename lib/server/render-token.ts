import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { renderSecret } from "./env";

/** Signature that lets only our worker load the unwatermarked render page. */
export function renderSignature(receiptId: string, secret = renderSecret()): string {
  return createHmac("sha256", secret).update(`render:${receiptId}`).digest("base64url");
}

export function verifyRenderSignature(receiptId: string, signature: string | undefined, secret = renderSecret()): boolean {
  if (!signature) return false;
  const expected = Buffer.from(renderSignature(receiptId, secret));
  const received = Buffer.from(signature);
  return expected.length === received.length && timingSafeEqual(expected, received);
}
