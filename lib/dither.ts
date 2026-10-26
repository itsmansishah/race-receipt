// 1-bit image treatments. Thermal printers only print dots, so every photo
// goes through one of these before it reaches the receipt.

export type DitherAlgo = "atkinson" | "floyd-steinberg" | "halftone";

export const DITHER_LABELS: Record<DitherAlgo, string> = {
  atkinson: "Atkinson",
  "floyd-steinberg": "Floyd–Steinberg",
  halftone: "Riso halftone",
};

/** Thermal head width for an 80 mm printer; photos are dithered at this resolution. */
export const THERMAL_DOTS = 576;

/** RGBA → luminance (0 = black, 255 = white), with simple contrast/brightness adjustment. */
export function toGrayscale(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  { brightness = 0, contrast = 0 }: { brightness?: number; contrast?: number } = {},
): Float32Array {
  const out = new Float32Array(width * height);
  // contrast in [-100, 100] → factor; standard formula.
  const c = Math.max(-99, Math.min(99, contrast)) * 2.55;
  const factor = (259 * (c + 255)) / (255 * (259 - c));
  for (let i = 0; i < out.length; i++) {
    const r = rgba[i * 4];
    const g = rgba[i * 4 + 1];
    const b = rgba[i * 4 + 2];
    const a = rgba[i * 4 + 3] / 255;
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) * a + 255 * (1 - a);
    out[i] = Math.max(0, Math.min(255, factor * (lum - 128) + 128 + brightness));
  }
  return out;
}

type Kernel = [dx: number, dy: number, weight: number][];

const ATKINSON: Kernel = [
  [1, 0, 1 / 8], [2, 0, 1 / 8],
  [-1, 1, 1 / 8], [0, 1, 1 / 8], [1, 1, 1 / 8],
  [0, 2, 1 / 8],
];

const FLOYD_STEINBERG: Kernel = [
  [1, 0, 7 / 16],
  [-1, 1, 3 / 16], [0, 1, 5 / 16], [1, 1, 1 / 16],
];

function errorDiffuse(gray: Float32Array, width: number, height: number, kernel: Kernel): Uint8Array {
  const buf = Float32Array.from(gray);
  const ink = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const old = buf[i];
      const next = old < 128 ? 0 : 255;
      ink[i] = next === 0 ? 1 : 0;
      const err = old - next;
      for (const [dx, dy, w] of kernel) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < width && ny < height) buf[ny * width + nx] += err * w;
      }
    }
  }
  return ink;
}

function halftone(gray: Float32Array, width: number, height: number, cell = 8): Uint8Array {
  const ink = new Uint8Array(width * height);
  for (let cy = 0; cy < height; cy += cell) {
    for (let cx = 0; cx < width; cx += cell) {
      let sum = 0;
      let n = 0;
      for (let y = cy; y < Math.min(cy + cell, height); y++) {
        for (let x = cx; x < Math.min(cx + cell, width); x++) {
          sum += gray[y * width + x];
          n++;
        }
      }
      const darkness = 1 - sum / n / 255;
      // Dot area tracks darkness; near-black cells print solid.
      const radius = darkness > 0.92 ? cell : cell * Math.sqrt(darkness / Math.PI) * 1.06;
      const mx = cx + cell / 2;
      const my = cy + cell / 2;
      for (let y = cy; y < Math.min(cy + cell, height); y++) {
        for (let x = cx; x < Math.min(cx + cell, width); x++) {
          const dx = x + 0.5 - mx;
          const dy = y + 0.5 - my;
          if (dx * dx + dy * dy <= radius * radius) ink[y * width + x] = 1;
        }
      }
    }
  }
  return ink;
}

/** Returns a 1-bit mask: 1 = ink dot, 0 = bare paper. */
export function dither(gray: Float32Array, width: number, height: number, algo: DitherAlgo): Uint8Array {
  switch (algo) {
    case "atkinson":
      return errorDiffuse(gray, width, height, ATKINSON);
    case "floyd-steinberg":
      return errorDiffuse(gray, width, height, FLOYD_STEINBERG);
    case "halftone":
      return halftone(gray, width, height);
  }
}

/** Paints a 1-bit mask as ink-coloured pixels on a transparent background. */
export function maskToRgba(mask: Uint8Array, inkHex: string): Uint8ClampedArray<ArrayBuffer> {
  const r = parseInt(inkHex.slice(1, 3), 16);
  const g = parseInt(inkHex.slice(3, 5), 16);
  const b = parseInt(inkHex.slice(5, 7), 16);
  const out = new Uint8ClampedArray(mask.length * 4);
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    out[i * 4] = r;
    out[i * 4 + 1] = g;
    out[i * 4 + 2] = b;
    out[i * 4 + 3] = 255;
  }
  return out;
}
