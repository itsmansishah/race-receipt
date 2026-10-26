// Physical layout. The receipt is laid out once in "canvas units" (u). A print
// sheet is always 1000u wide, so one layout serves every size: bigger prints
// are the same composition printed larger, and only the sheet's aspect ratio
// (and so the room for a long receipt) changes.

import type { FrameColor, FrameOption, PrintSize, ReceiptState } from "./receipt-state";

export const CANVAS = {
  sheetWidth: 1000,
  /** Receipt strip width. On an 8×10 it prints about 3 in wide, close to real 80 mm paper. */
  stripWidth: 380,
  /** Clear space above and below the strip on the sheet. */
  sheetMarginY: 52,
  /** Below this, text is too small to print legibly, so checkout is blocked. */
  minScale: 0.75,
} as const;

export const PRINT_SIZES: Record<PrintSize, { widthIn: number; heightIn: number; label: string; price: number }> = {
  "8x10": { widthIn: 8, heightIn: 10, label: "8 × 10 in", price: 39 },
  "11x14": { widthIn: 11, heightIn: 14, label: "11 × 14 in", price: 59 },
  "12x18": { widthIn: 12, heightIn: 18, label: "12 × 18 in", price: 79 },
};

export const FRAME_OPTIONS: Record<FrameOption, { label: string; price: number }> = {
  none: { label: "Unframed", price: 0 },
  frame: { label: "Framed", price: 60 },
  "frame-mat": { label: "Framed with mat", price: 80 },
};

export const FRAME_COLORS: Record<FrameColor, { label: string; hex: string }> = {
  black: { label: "Black", hex: "#1f1a17" },
  oak: { label: "Natural oak", hex: "#b48a5a" },
  white: { label: "White", hex: "#f2efe8" },
};

export function sheetHeight(size: PrintSize): number {
  const { widthIn, heightIn } = PRINT_SIZES[size];
  return (CANVAS.sheetWidth * heightIn) / widthIn;
}

export function availableStripHeight(size: PrintSize): number {
  return sheetHeight(size) - CANVAS.sheetMarginY * 2;
}

export type FitStatus = "fits" | "scaled" | "too-long";

export interface Fit {
  scale: number;
  status: FitStatus;
}

/** How much a strip of `naturalHeight` must shrink to fit `available`. */
export function fitStrip(naturalHeight: number, available: number): Fit {
  if (naturalHeight <= 0 || naturalHeight <= available) return { scale: 1, status: "fits" };
  const scale = available / naturalHeight;
  return { scale, status: scale < CANVAS.minScale ? "too-long" : "scaled" };
}

export function priceBreakdown(print: ReceiptState["print"]) {
  const base = PRINT_SIZES[print.size].price;
  const frame = FRAME_OPTIONS[print.frame].price;
  return { base, frame, total: base + frame };
}

export function formatPrice(dollars: number): string {
  return `$${dollars.toFixed(2)}`;
}
