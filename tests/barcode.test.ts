import { describe, expect, it } from "vitest";
import { barcodePayload, code128Checksum, CODE128_PATTERNS, encodeCode128B, sanitizeForCode128B } from "@/lib/barcode";

describe("Code 128 patterns", () => {
  it("has 107 unique symbols, each 11 modules wide (stop: 13)", () => {
    expect(CODE128_PATTERNS).toHaveLength(107);
    expect(new Set(CODE128_PATTERNS).size).toBe(107);
    CODE128_PATTERNS.forEach((p, i) => {
      const sum = [...p].reduce((s, d) => s + Number(d), 0);
      expect(sum, `symbol ${i}`).toBe(i === 106 ? 13 : 11);
    });
  });
});

describe("encodeCode128B", () => {
  it("computes the weighted mod-103 checksum", () => {
    // Start B (104) + "PJJ123C": 104 + 48·1 + 42·2 + 42·3 + 17·4 + 18·5 + 19·6 + 35·7 = 879 → 879 mod 103 = 55
    expect(encodeCode128B("PJJ123C").checksum).toBe(55);
    expect(code128Checksum([104, 48, 42, 42, 17, 18, 19, 35])).toBe(55);
  });

  it("frames data with start B, checksum and stop", () => {
    const { codes, checksum } = encodeCode128B("AB");
    expect(codes).toEqual([104, 33, 34, checksum, 106]);
  });

  it("produces the right geometry", () => {
    const text = "40123-20261011";
    const { bars, width } = encodeCode128B(text);
    expect(width).toBe((text.length + 2) * 11 + 13);
    expect(bars).toHaveLength((text.length + 2) * 3 + 4);
    expect(bars.slice(0, 3)).toEqual([
      { x: 0, w: 2 },
      { x: 3, w: 1 },
      { x: 6, w: 1 },
    ]);
    // Ends on the stop pattern's final 2-module bar.
    const last = bars[bars.length - 1];
    expect(last.x + last.w).toBe(width);
  });

  it("is deterministic and changes with input", () => {
    expect(encodeCode128B("123")).toEqual(encodeCode128B("123"));
    expect(encodeCode128B("123").bars).not.toEqual(encodeCode128B("124").bars);
  });

  it("drops characters outside ASCII 32–126", () => {
    expect(sanitizeForCode128B("Bib\t#42é")).toBe("Bib#42");
  });
});

describe("barcodePayload", () => {
  it("combines bib and race date", () => {
    expect(barcodePayload("40123", "2026-10-11")).toBe("40123-20261011");
  });
  it("falls back when bib or date is missing", () => {
    expect(barcodePayload("  ", "")).toBe("0000-00000000");
    expect(barcodePayload("f12", "2026-04-20")).toBe("F12-20260420");
  });
});
