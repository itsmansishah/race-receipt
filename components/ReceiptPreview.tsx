"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AlertTriangle, Frame, ReceiptText } from "lucide-react";
import { ReceiptStrip } from "./receipt/ReceiptStrip";
import { PrintSheet, sheetOuterSize } from "./receipt/PrintSheet";
import { useReceipt, useReceiptDispatch } from "./ReceiptProvider";
import { CANVAS, FRAME_OPTIONS, PRINT_SIZES, type Fit } from "@/lib/print-sizes";
import type { PrintSize } from "@/lib/receipt-state";

type View = "framed" | "strip";

function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

interface ReceiptPreviewProps {
  fit: Fit;
  naturalHeight: number;
  onMeasure: (h: number) => void;
  fullSizeFit: PrintSize | undefined;
}

export function ReceiptPreview({ fit, naturalHeight, onMeasure, fullSizeFit }: ReceiptPreviewProps) {
  const state = useReceipt();
  const dispatch = useReceiptDispatch();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [chosenView, setView] = useState<View | null>(null);
  const [boundsRef, bounds] = useElementSize<HTMLDivElement>();
  // Phones open on the legible strip view; larger screens on the framed print.
  const view: View = chosenView ?? (isDesktop ? "framed" : "strip");

  const outer = sheetOuterSize(state.print, true);
  const displayScale =
    view === "framed"
      ? Math.min(bounds.width / outer.width, isDesktop && bounds.height ? bounds.height / outer.height : Infinity)
      : Math.min(1.2, bounds.width / (CANVAS.stripWidth + 24));
  const shownW = view === "framed" ? outer.width : CANVAS.stripWidth;
  const shownH = view === "framed" ? outer.height : naturalHeight * fit.scale;

  const size = PRINT_SIZES[state.print.size];
  const stripInches = (CANVAS.stripWidth / CANVAS.sheetWidth) * size.widthIn * fit.scale;
  const pct = Math.round(fit.scale * 100);

  const strip = <ReceiptStrip state={state} onMeasure={onMeasure} />;

  return (
    <section aria-label="Live preview" className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="caps-wide text-[11px]">Live preview</h2>
        <div role="radiogroup" aria-label="Preview view" className="flex rounded-full border border-line bg-panel p-0.5">
          {(
            [
              { value: "strip", label: "Receipt", Icon: ReceiptText },
              { value: "framed", label: "On the wall", Icon: Frame },
            ] as const
          ).map(({ value, label, Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={view === value}
              onClick={() => setView(value)}
              className={`flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors ${
                view === value ? "bg-ink text-paper" : "text-ink-soft hover:text-ink"
              }`}
            >
              <Icon size={14} aria-hidden />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div ref={boundsRef} className="relative min-h-0 flex-1">
        <div className="mx-auto" style={{ width: shownW * displayScale, height: shownH * displayScale }}>
          {displayScale > 0 && (
            <div style={{ width: shownW, transform: `scale(${displayScale})`, transformOrigin: "top left" }}>
              {view === "framed" ? (
                <PrintSheet print={state.print} fit={fit} stripHeight={naturalHeight} withFrame>
                  {strip}
                </PrintSheet>
              ) : (
                <div
                  style={{
                    marginLeft: (CANVAS.stripWidth * (1 - fit.scale)) / 2,
                    transform: `scale(${fit.scale})`,
                    transformOrigin: "top left",
                    filter: "drop-shadow(0 6px 10px rgba(42,32,25,0.18))",
                  }}
                >
                  {strip}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <p className="text-center font-mono text-[11px] text-ink-soft">
        {size.label} · {FRAME_OPTIONS[state.print.frame].label} · strip prints {stripInches.toFixed(1)} in wide
      </p>

      <div aria-live="polite">
        {fit.status !== "fits" && (
          <div
            role={fit.status === "too-long" ? "alert" : "status"}
            className={`flex gap-2.5 rounded-lg border p-3 text-sm ${
              fit.status === "too-long" ? "border-spot bg-spot/10" : "border-line bg-panel"
            }`}
          >
            <AlertTriangle size={18} className={`mt-0.5 shrink-0 ${fit.status === "too-long" ? "text-spot" : ""}`} aria-hidden />
            <div className="space-y-1.5">
              <p>
                {fit.status === "too-long" ? (
                  <>
                    <strong>Too long to print legibly at {size.label}.</strong> At {pct}% the text would be too
                    small. Remove items or a block, or choose a larger print. Checkout is paused until it fits.
                  </>
                ) : (
                  <>
                    <strong>Shrunk to {pct}% to fit {size.label}.</strong> The print will look exactly like this
                    preview, with slightly smaller text.
                  </>
                )}
              </p>
              {fullSizeFit && fullSizeFit !== state.print.size && (
                <button
                  type="button"
                  onClick={() => dispatch({ type: "setPrint", patch: { size: fullSizeFit } })}
                  className="font-medium underline underline-offset-2"
                >
                  Switch to {PRINT_SIZES[fullSizeFit].label} (fits at full size)
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
