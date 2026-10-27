import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyShopifyHmac } from "@/lib/server/shopify/hmac";

const SECRET = "test-client-secret";
const BODY = Buffer.from(JSON.stringify({ id: 820982911946154500, name: "#1001" }));
const sign = (body: Buffer | string, secret = SECRET) => createHmac("sha256", secret).update(body).digest("base64");

describe("verifyShopifyHmac", () => {
  it("accepts a valid signature over the raw body", () => {
    expect(verifyShopifyHmac(BODY, sign(BODY), SECRET)).toBe(true);
    expect(verifyShopifyHmac(BODY.toString("utf8"), sign(BODY), SECRET)).toBe(true);
  });

  it("rejects a signature made with a different secret", () => {
    expect(verifyShopifyHmac(BODY, sign(BODY, "someone-else"), SECRET)).toBe(false);
  });

  it("rejects a tampered body", () => {
    const tampered = Buffer.from(BODY.toString().replace("#1001", "#1002"));
    expect(verifyShopifyHmac(tampered, sign(BODY), SECRET)).toBe(false);
  });

  it("rejects re-serialised JSON (signature is over the exact bytes)", () => {
    const reformatted = JSON.stringify(JSON.parse(BODY.toString()), null, 2);
    expect(verifyShopifyHmac(reformatted, sign(BODY), SECRET)).toBe(false);
  });

  it("rejects a missing or empty header", () => {
    expect(verifyShopifyHmac(BODY, null, SECRET)).toBe(false);
    expect(verifyShopifyHmac(BODY, undefined, SECRET)).toBe(false);
    expect(verifyShopifyHmac(BODY, "", SECRET)).toBe(false);
  });

  it("rejects a header of the wrong length without throwing", () => {
    const valid = sign(BODY);
    expect(() => verifyShopifyHmac(BODY, valid.slice(0, 20), SECRET)).not.toThrow();
    expect(verifyShopifyHmac(BODY, valid.slice(0, 20), SECRET)).toBe(false);
    expect(verifyShopifyHmac(BODY, valid + valid, SECRET)).toBe(false);
    // A hex digest is the right algorithm but the wrong encoding and length.
    const hex = createHmac("sha256", SECRET).update(BODY).digest("hex");
    expect(verifyShopifyHmac(BODY, hex, SECRET)).toBe(false);
  });

  it("rejects non-base64 junk and a missing secret", () => {
    expect(verifyShopifyHmac(BODY, "not base64 at all!!", SECRET)).toBe(false);
    expect(verifyShopifyHmac(BODY, sign(BODY), "")).toBe(false);
  });
});
