import { describe, expect, it } from "vitest";
import { dither, maskToRgba, type DitherAlgo } from "@/lib/dither";

const flat = (value: number, n = 64 * 64) => new Float32Array(n).fill(value);
const inkRatio = (mask: Uint8Array) => mask.reduce((s, v) => s + v, 0) / mask.length;

describe("dither", () => {
  for (const algo of ["atkinson", "floyd-steinberg", "halftone"] as DitherAlgo[]) {
    it(`${algo}: black is all ink, white is bare paper, grey is in between`, () => {
      expect(inkRatio(dither(flat(0), 64, 64, algo))).toBeGreaterThan(0.95);
      expect(inkRatio(dither(flat(255), 64, 64, algo))).toBe(0);
      const grey = inkRatio(dither(flat(128), 64, 64, algo));
      expect(grey).toBeGreaterThan(0.25);
      expect(grey).toBeLessThan(0.75);
    });
  }

  it("outputs a strict 1-bit mask", () => {
    const gradient = Float32Array.from({ length: 32 * 32 }, (_, i) => (i % 32) * 8);
    expect(dither(gradient, 32, 32, "atkinson").every((v) => v === 0 || v === 1)).toBe(true);
  });

  it("paints ink pixels opaque and paper transparent", () => {
    const rgba = maskToRgba(Uint8Array.from([1, 0]), "#2a2019");
    expect(Array.from(rgba)).toEqual([0x2a, 0x20, 0x19, 255, 0, 0, 0, 0]);
  });
});
