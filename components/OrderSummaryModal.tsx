"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle, FileDown, Lock, Truck, X } from "lucide-react";
import { useReceipt } from "./ReceiptProvider";
import { priceDisplay } from "./price";
import { useCatalog } from "./useCatalog";
import { useCheckout } from "./useCheckout";
import { FRAME_COLORS, FRAME_OPTIONS, PRINT_SIZES } from "@/lib/print-sizes";
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
  const catalog = useCatalog();
  const { phase, start, reset } = useCheckout();
  const ref = useRef<HTMLDialogElement>(null);
  const busy = phase.status === "saving" || phase.status === "redirecting";

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const close = () => {
    if (busy) return;
    reset();
    onClose();
  };

  const price = priceDisplay(catalog, state.print);
  const kind = receiptKind(state);
  const isGift = state.giftFor === "friend";
  const blocking = [
    isGift && !state.recipientName.trim() && "Add the recipient's name (section 01).",
    state.hero.kind === "photo" && !state.hero.photo && "Add a photo, or choose the course map or no image (section 03).",
    !price.available && "This size and finish isn't available right now. Pick another in section 07.",
  ].filter(Boolean) as string[];
  const warnings = [
    !state.runnerName.trim() && "No runner name yet.",
    !state.raceTitle.trim() && "No race name yet.",
    ...validateSplits(state).map((i) => `${i.message} (it won't print until fixed).`),
  ].filter(Boolean) as string[];

  return (
    <dialog
      ref={ref}
      onClose={close}
      onCancel={(e) => busy && e.preventDefault()}
      onClick={(e) => e.target === ref.current && close()}
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
          <button
            type="button"
            onClick={close}
            disabled={busy}
            aria-label="Close"
            className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-ink/10 disabled:opacity-40"
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        {(blocking.length > 0 || warnings.length > 0) && (
          <ul className="mb-4 space-y-1 rounded-lg border border-line bg-white/60 p-3 text-sm">
            {blocking.map((w) => (
              <li key={w} className="text-spot">
                · {w}
              </li>
            ))}
            {warnings.map((w) => (
              <li key={w}>· {w}</li>
            ))}
          </ul>
        )}

        <dl className="divide-y divide-line text-sm">
          <Row label="For" value={isGift ? `Gift for ${state.recipientName || "—"}` : "Myself"} />
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
          {isGift && state.giftMessage && <Row label="Gift card" value={`“${state.giftMessage}”`} />}
        </dl>

        <dl className="mt-4 rounded-lg bg-white/60 p-3 font-mono text-sm">
          <div className="flex justify-between font-bold">
            <dt>Print{state.print.frame !== "none" ? " + frame" : ""}</dt>
            <dd>{price.label}</dd>
          </div>
          <Row label="Shipping and tax" value="At checkout" />
          {!price.live && <p className="pt-1 text-[11px] text-ink-soft">Estimated price: live prices load from our store.</p>}
        </dl>

        {isGift && (
          <p className="mt-4 flex gap-2 rounded-lg border border-line p-3 text-sm">
            <Truck size={18} className="mt-0.5 shrink-0" aria-hidden />
            <span>
              At checkout, enter <strong>{state.recipientName || "the recipient"}</strong>&apos;s address as the
              shipping address. We ship straight to them with your gift card and no prices.
            </span>
          </p>
        )}

        <div aria-live="assertive">
          {phase.status === "error" && (
            <p role="alert" className="mt-4 flex gap-2 rounded-lg border border-spot bg-spot/10 p-3 text-sm">
              <AlertTriangle size={18} className="mt-0.5 shrink-0 text-spot" aria-hidden />
              <span>
                {phase.message} <span className="text-ink-soft">Your design is still here.</span>
              </span>
            </p>
          )}
        </div>

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
            disabled={busy || blocking.length > 0}
            onClick={() => void start(state)}
            className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-ink px-4 text-sm font-medium text-paper hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Lock size={15} aria-hidden />
            {phase.status === "saving"
              ? "Saving your design…"
              : phase.status === "redirecting"
                ? "Opening checkout…"
                : phase.status === "error"
                  ? "Try again"
                  : "Secure checkout"}
          </button>
        </div>
        <p className="mt-2 text-center text-xs text-ink-soft">Payment is handled by Shopify&apos;s secure checkout.</p>
      </div>
    </dialog>
  );
}
