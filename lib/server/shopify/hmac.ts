import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verifies X-Shopify-Hmac-SHA256: base64(HMAC-SHA256(rawBody, clientSecret)).
 * Must be given the exact raw bytes Shopify sent, before any JSON parsing.
 */
export function verifyShopifyHmac(rawBody: Buffer | string, header: string | null | undefined, secret: string): boolean {
  if (!header || !secret) return false;

  const expected = createHmac("sha256", secret).update(rawBody).digest();
  // Reject anything that isn't canonical base64 before decoding: Buffer.from
  // silently skips invalid characters.
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(header.trim())) return false;
  const received = Buffer.from(header.trim(), "base64");

  // timingSafeEqual throws on length mismatch; a wrong length is simply invalid.
  if (received.length !== expected.length) return false;
  return timingSafeEqual(received, expected);
}
