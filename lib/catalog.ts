// How our print options map to the single "Race Receipt" Shopify product.
// Two options: Size (3 values) × Finish (7 values) = 21 variants.
// Shared by client and server; contains no secrets.

import type { FrameColor, FrameOption, PrintSize, ReceiptState } from "./receipt-state";

export const SIZE_OPTION = "Size";
export const FINISH_OPTION = "Finish";

export const SIZE_VALUES: Record<PrintSize, string> = { "8x10": "8x10", "11x14": "11x14", "12x18": "12x18" };

const COLOR_WORD: Record<FrameColor, string> = { black: "Black", oak: "Oak", white: "White" };

/** "Unframed", "Black frame", "Oak frame + mat", … */
export function finishValue(frame: FrameOption, color: FrameColor): string {
  if (frame === "none") return "Unframed";
  return `${COLOR_WORD[color]} frame${frame === "frame-mat" ? " + mat" : ""}`;
}

export function allFinishValues(): string[] {
  const colors = Object.keys(COLOR_WORD) as FrameColor[];
  return ["Unframed", ...colors.map((c) => finishValue("frame", c)), ...colors.map((c) => finishValue("frame-mat", c))];
}

export function variantKey(size: string, finish: string): string {
  return `${size}|${finish}`;
}

export function variantKeyFor(print: ReceiptState["print"]): string {
  return variantKey(SIZE_VALUES[print.size], finishValue(print.frame, print.frameColor));
}

/** A variant as the customizer sees it. Prices come from Shopify. */
export interface CatalogVariant {
  id: string;
  size: string;
  finish: string;
  price: { amount: string; currencyCode: string };
  availableForSale: boolean;
}

export interface Catalog {
  variants: Record<string, CatalogVariant>;
}

export function formatMoney({ amount, currencyCode }: { amount: string; currencyCode: string }): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currencyCode }).format(Number(amount));
  } catch {
    return `${amount} ${currencyCode}`;
  }
}
