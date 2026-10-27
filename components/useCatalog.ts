"use client";

import { useSyncExternalStore } from "react";
import { variantKeyFor, type Catalog, type CatalogVariant } from "@/lib/catalog";
import type { ReceiptState } from "@/lib/receipt-state";

export type CatalogState =
  | { status: "loading" }
  | { status: "ready"; catalog: Catalog }
  | { status: "unconfigured" }
  | { status: "error" };

// One fetch per page load, shared by every component that shows a price.
let state: CatalogState = { status: "loading" };
let started = false;
const listeners = new Set<() => void>();

function load() {
  if (started) return;
  started = true;
  fetch("/api/catalog")
    .then((res) => res.json())
    .then((body: { configured: boolean; error?: string; variants: Catalog["variants"] }) => {
      state = !body.configured
        ? { status: "unconfigured" }
        : body.error || !Object.keys(body.variants).length
          ? { status: "error" }
          : { status: "ready", catalog: { variants: body.variants } };
    })
    .catch(() => {
      state = { status: "error" };
    })
    .finally(() => listeners.forEach((l) => l()));
}

const SERVER_STATE: CatalogState = { status: "loading" };

/** Live Shopify prices and availability. Falls back to placeholder prices when unavailable. */
export function useCatalog(): CatalogState {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      load();
      return () => listeners.delete(onChange);
    },
    () => state,
    () => SERVER_STATE,
  );
}

export function variantFor(catalog: CatalogState, print: ReceiptState["print"]): CatalogVariant | null {
  return catalog.status === "ready" ? (catalog.catalog.variants[variantKeyFor(print)] ?? null) : null;
}
