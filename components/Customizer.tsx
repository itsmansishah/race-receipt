"use client";

import { useState } from "react";
import { Eye, ShoppingBag } from "lucide-react";
import { CustomizerForm } from "./CustomizerForm";
import { OrderSummaryModal } from "./OrderSummaryModal";
import { ReceiptPreview } from "./ReceiptPreview";
import { useReceipt } from "./ReceiptProvider";
import { useStripFit } from "./receipt/useStripFit";
import { formatPrice, PRINT_SIZES, priceBreakdown } from "@/lib/print-sizes";

export function Customizer() {
  const state = useReceipt();
  const { fit, naturalHeight, onMeasure, fullSizeFit } = useStripFit(state.print.size);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const blocked = fit.status === "too-long";
  const price = priceBreakdown(state.print);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div>
            <p className="caps-wide text-[13px] font-bold">Race Receipt</p>
            <p className="text-xs text-ink-soft">The marathon, itemised. Printed and framed.</p>
          </div>
          <p className="hidden font-mono text-[11px] text-ink-soft sm:block">Ships in 5–7 days</p>
        </div>
        <div aria-hidden className="hazard h-1.5 opacity-90" />
      </header>

      <main className="mx-auto grid w-full max-w-7xl flex-1 gap-6 px-4 pt-5 pb-28 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-10 lg:pb-10">
        <div id="preview" className="lg:sticky lg:top-0 lg:order-2 lg:h-dvh lg:py-5">
          <div className="max-h-[62svh] overflow-y-auto rounded-xl border border-line bg-app/60 p-3 lg:h-full lg:max-h-none lg:overflow-visible lg:border-0 lg:bg-transparent lg:p-0">
            <ReceiptPreview fit={fit} naturalHeight={naturalHeight} onMeasure={onMeasure} fullSizeFit={fullSizeFit} />
          </div>
        </div>

        <div className="lg:order-1">
          <h1 className="mb-1 text-2xl font-medium tracking-tight sm:text-3xl">Design their Race Receipt</h1>
          <p className="mb-5 text-sm text-ink-soft">
            Everything updates on the receipt as you type. No finish time yet? It prints as a race-day receipt.
          </p>
          <CustomizerForm />
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-panel/95 backdrop-blur lg:static lg:border-t-0 lg:bg-transparent">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6 lg:justify-end lg:pb-8">
          <div className="min-w-0 flex-1 lg:flex-none lg:text-right">
            <p className="font-mono text-base font-bold">{formatPrice(price.total)}</p>
            <p className="truncate text-xs text-ink-soft">
              {blocked ? "Too long for this size" : `${PRINT_SIZES[state.print.size].label} · plus shipping`}
            </p>
          </div>
          <a
            href="#preview"
            className="flex min-h-11 items-center gap-1.5 rounded-full border border-ink px-4 text-sm font-medium lg:hidden"
          >
            <Eye size={16} aria-hidden /> Preview
          </a>
          <button
            type="button"
            disabled={blocked}
            onClick={() => setSummaryOpen(true)}
            className="flex min-h-11 items-center gap-1.5 rounded-full bg-ink px-5 text-sm font-medium text-paper hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ShoppingBag size={16} aria-hidden /> Review order
          </button>
        </div>
      </div>

      <OrderSummaryModal open={summaryOpen} onClose={() => setSummaryOpen(false)} />
    </div>
  );
}
