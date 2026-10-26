"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { ArrowLeft, Printer } from "lucide-react";
import { PrintSheet } from "./receipt/PrintSheet";
import { ReceiptStrip } from "./receipt/ReceiptStrip";
import { useStripFit } from "./receipt/useStripFit";
import { loadDraft } from "@/lib/persistence";
import { CANVAS, PRINT_SIZES } from "@/lib/print-sizes";
import { createInitialState, type ReceiptState } from "@/lib/receipt-state";

const CSS_PX_PER_INCH = 96;

let cachedDraft: ReceiptState | null = null;
const readDraft = () => (cachedDraft ??= loadDraft() ?? createInitialState());
const noSubscribe = () => () => {};

/**
 * A watermarked proof at true physical size, using the same strip and sheet
 * components as the preview. Print it or "Save as PDF" from the browser.
 */
export function PrintProof() {
  // The draft lives in browser storage, so render nothing on the server.
  const state = useSyncExternalStore(noSubscribe, readDraft, () => null);

  if (!state) return null;
  return <Proof state={state} />;
}

function Proof({ state }: { state: ReceiptState }) {
  const { fit, naturalHeight, onMeasure } = useStripFit(state.print.size);
  const size = PRINT_SIZES[state.print.size];
  const scale = (size.widthIn * CSS_PX_PER_INCH) / CANVAS.sheetWidth;

  return (
    <div className="min-h-dvh bg-white py-6 print:p-0">
      <style>{`@page { size: ${size.widthIn}in ${size.heightIn}in; margin: 0; }`}</style>
      <div className="mx-auto mb-6 flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 print:hidden">
        <Link href="/" className="flex min-h-11 items-center gap-1.5 text-sm text-ink-soft hover:text-ink">
          <ArrowLeft size={16} aria-hidden /> Back to editing
        </Link>
        <p className="text-xs text-ink-soft">
          Watermarked proof at actual size ({size.label}). Use Print, then “Save as PDF”.
        </p>
        <button
          type="button"
          onClick={() => window.print()}
          className="flex min-h-11 items-center gap-1.5 rounded-full bg-ink px-5 text-sm font-medium text-paper"
        >
          <Printer size={16} aria-hidden /> Print proof
        </button>
      </div>
      <div className="overflow-x-auto print:overflow-visible">
        <div
          className="mx-auto print:m-0"
          style={{ width: size.widthIn * CSS_PX_PER_INCH, height: size.heightIn * CSS_PX_PER_INCH }}
        >
          <div style={{ width: CANVAS.sheetWidth, transform: `scale(${scale})`, transformOrigin: "top left" }}>
            <PrintSheet print={state.print} fit={fit} stripHeight={naturalHeight} withFrame={false} watermark animate={false}>
              <ReceiptStrip state={state} onMeasure={onMeasure} animate={false} />
            </PrintSheet>
          </div>
        </div>
      </div>
    </div>
  );
}
