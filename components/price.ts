import { formatMoney } from "@/lib/catalog";
import { formatPrice, priceBreakdown } from "@/lib/print-sizes";
import type { ReceiptState } from "@/lib/receipt-state";
import { variantFor, type CatalogState } from "./useCatalog";

export interface PriceDisplay {
  label: string;
  /** True when the price came from Shopify. */
  live: boolean;
  available: boolean;
}

/** Shopify's price when we have it; otherwise the placeholder price table. */
export function priceDisplay(catalog: CatalogState, print: ReceiptState["print"]): PriceDisplay {
  if (catalog.status === "ready") {
    const variant = variantFor(catalog, print);
    if (!variant) return { label: "Unavailable", live: true, available: false };
    return { label: formatMoney(variant.price), live: true, available: variant.availableForSale };
  }
  return { label: formatPrice(priceBreakdown(print).total), live: false, available: true };
}
