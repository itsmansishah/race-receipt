"use client";

import { useState } from "react";
import { clearPendingCheckout, loadPendingCheckout, savePendingCheckout } from "@/lib/persistence";
import type { ReceiptState } from "@/lib/receipt-state";

type CheckoutResponse =
  | { ok: true; receiptId: string; checkoutUrl: string }
  | { ok: false; code: string; message: string; receiptId?: string };

export type CheckoutPhase = { status: "idle" } | { status: "saving" } | { status: "redirecting" } | { status: "error"; message: string };

async function post(design: ReceiptState, receiptId: string | undefined): Promise<CheckoutResponse> {
  try {
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ design, receiptId }),
    });
    return (await res.json()) as CheckoutResponse;
  } catch {
    return { ok: false, code: "network", message: "We couldn't reach our server. Check your connection and try again." };
  }
}

/**
 * Saves the design, gets a Shopify checkout URL and leaves the page for it.
 * The design stays in this browser whatever happens, so a failure never loses work.
 */
export function useCheckout() {
  const [phase, setPhase] = useState<CheckoutPhase>({ status: "idle" });

  const start = async (design: ReceiptState) => {
    setPhase({ status: "saving" });
    let result = await post(design, loadPendingCheckout()?.receiptId);
    if (!result.ok && result.code === "already_paid") {
      // The earlier receipt was ordered: this is a new order with a new receipt.
      clearPendingCheckout();
      result = await post(design, undefined);
    }
    if (!result.ok) {
      if (result.receiptId) savePendingCheckout(result.receiptId);
      setPhase({ status: "error", message: result.message });
      return;
    }
    savePendingCheckout(result.receiptId);
    setPhase({ status: "redirecting" });
    // Full-page redirect: Shopify's checkout can't be embedded.
    window.location.assign(result.checkoutUrl);
  };

  return { phase, start, reset: () => setPhase({ status: "idle" }) };
}
