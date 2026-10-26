"use client";

import { useEffect, useRef } from "react";
import { FileDown, X } from "lucide-react";
import { useReceipt } from "./ReceiptProvider";
import { FRAME_COLORS, FRAME_OPTIONS, formatPrice, PRINT_SIZES, priceBreakdown } from "@/lib/print-sizes";
import { receiptKind, validateSplits } from "@/lib/receipt-state";
import { formatReceiptDate } from "@/lib/time";
import { SPOT_INKS } from "@/lib/tokens";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5">
      <dt className="text-ink-soft">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}

export function OrderSummaryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const state = useReceipt();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const price = priceBreakdown(state.print);
  const kind = receiptKind(state);
  const warnings = [
    !state.runnerName.trim() && "No runner name yet.",
    !state.raceTitle.trim() && "No race name yet.",
    state.giftFor === "friend" && !state.recipientName.trim() && "Who's it for? Add a recipient name.",
    state.hero.kind === "photo" && !state.hero.photo && "Photo hero chosen but no photo added.",
    ...validateSplits(state).map((i) => i.message),
  ].filter(Boolean) as string[];

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="order-summary-title"
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl bg-panel p-0 text-ink shadow-2xl backdrop:bg-ink/50"
    >
      <div className="max-h-[85dvh] overflow-y-auto p-5 sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="caps-wide text-[10px] text-ink-soft">Order summary</p>
            <h2 id="order-summary-title" className="mt-1 text-xl font-medium">
              {state.raceTitle || "Your Race Receipt"}
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-ink/10">
            <X size={18} aria-hidden />
          </button>
        </div>

        {warnings.length > 0 && (
          <ul className="mb-4 space-y-1 rounded-lg border border-line bg-white/60 p-3 text-sm">
            {warnings.map((w) => (
              <li key={w}>· {w}</li>
            ))}
          </ul>
        )}

        <dl className="divide-y divide-line text-sm">
          <Row label="For" value={state.giftFor === "friend" ? `Gift for ${state.recipientName || "—"}` : "Myself"} />
          <Row label="Runner" value={state.runnerName || "—"} />
          <Row label="Race" value={[state.city, formatReceiptDate(state.raceDate)].filter(Boolean).join(" · ") || "—"} />
          <Row label="Receipt" value={kind === "finished" ? `Finished · ${state.finishTime}` : "Race-day"} />
          <Row label="Items" value={state.items.length} />
          <Row label="Inks" value={`Warm black${state.print.spotInk !== "none" ? ` + ${SPOT_INKS[state.print.spotInk].label}` : ""}`} />
          <Row label="Size" value={PRINT_SIZES[state.print.size].label} />
          <Row
            label="Finish"
            value={`${FRAME_OPTIONS[state.print.frame].label}${state.print.frame !== "none" ? `, ${FRAME_COLORS[state.print.frameColor].label.toLowerCase()}` : ""}`}
          />
          {state.giftFor === "friend" && state.giftMessage && <Row label="Gift card" value={`“${state.giftMessage}”`} />}
        </dl>

        <dl className="mt-4 rounded-lg bg-white/60 p-3 font-mono text-sm">
          <Row label="Print" value={formatPrice(price.base)} />
          {price.frame > 0 && <Row label="Frame" value={formatPrice(price.frame)} />}
          <Row label="Shipping" value="At checkout" />
          <div className="mt-1 flex justify-between border-t border-dashed border-ink/40 pt-2 font-bold">
            <dt>Total</dt>
            <dd>{formatPrice(price.total)}</dd>
          </div>
        </dl>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <a
            href="/print"
            target="_blank"
            rel="noopener"
            className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full border border-ink px-4 text-sm font-medium hover:bg-white/70"
          >
            <FileDown size={16} aria-hidden /> Watermarked proof
          </a>
          <button
            type="button"
            disabled
            aria-describedby="checkout-note"
            className="min-h-11 flex-1 cursor-not-allowed rounded-full bg-ink px-4 text-sm font-medium text-paper opacity-50"
          >
            Continue to payment
          </button>
        </div>
        <p id="checkout-note" className="mt-2 text-center text-xs text-ink-soft">
          Prototype: payment and shipping aren&apos;t connected yet.
        </p>
      </div>
    </dialog>
  );
}
