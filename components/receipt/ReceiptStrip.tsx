"use client";

import { Fragment, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Barcode } from "../Barcode";
import { RouteMap } from "../RouteMap";
import { PaperTexture } from "./PaperTexture";
import { CANVAS } from "@/lib/print-sizes";
import { barcodePayload } from "@/lib/barcode";
import { finishSeconds, receiptKind, SPLITS, validateSplits, type ReceiptState } from "@/lib/receipt-state";
import {
  formatDistance,
  formatPace,
  formatReceiptDate,
  formatShortDate,
  formatTime,
  MARATHON_KM,
  parseTime,
} from "@/lib/time";
import { IMPERFECTION, seededRandom, SPOT_INKS } from "@/lib/tokens";

// All sizes below are canvas units (1u = 1px before the preview/print scale).
const PAD_X = 22;
const INNER = CANVAS.stripWidth - PAD_X * 2;
const HERO_H = Math.round((INNER * 2) / 3);
const TOOTH = 9;
const TOOTH_DEPTH = 6;

/** A torn, slightly uneven top and bottom edge as a clip-path polygon. */
function tornEdgePolygon(seed: string): string {
  const rand = seededRandom(`${seed}-edge`);
  const teeth = Math.ceil(CANVAS.stripWidth / TOOTH);
  const top: string[] = [];
  const bottom: string[] = [];
  for (let i = 0; i <= teeth; i++) {
    const x = Math.min(CANVAS.stripWidth, i * TOOTH);
    const deep = i % 2 === 1;
    const jitter = rand() * 2.5;
    top.push(`${x}px ${deep ? TOOTH_DEPTH + jitter : jitter}px`);
    bottom.unshift(`${x}px calc(100% - ${deep ? TOOTH_DEPTH + jitter : jitter}px)`);
  }
  return `polygon(${[...top, ...bottom].join(", ")})`;
}

/** Hero number size so it spans the strip without overflowing. */
function heroFontSize(text: string): number {
  let em = 0;
  for (const ch of text) em += /\d/.test(ch) ? 0.58 : 0.3;
  return Math.min(104, Math.floor(INNER / Math.max(em, 1)));
}

function Leader({ label, value, strong }: { label: ReactNode; value: ReactNode; strong?: boolean }) {
  return (
    <div className={`flex items-baseline gap-[6px] ${strong ? "font-bold" : ""}`}>
      <span className="shrink-0">{label}</span>
      <span aria-hidden className="min-w-[12px] flex-1 translate-y-[-4px] border-b-2 border-dotted border-current opacity-70" />
      <span className="max-w-[62%] text-right [overflow-wrap:anywhere]">{value}</span>
    </div>
  );
}

function Hazard() {
  return <div aria-hidden className="hazard my-[14px] h-[11px]" />;
}

function Dashed() {
  return <div aria-hidden className="my-[10px] border-t-2 border-dashed border-current opacity-80" />;
}

function SmallCaps({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`caps-wide text-[10px] leading-[16px] ${className}`}>{children}</div>;
}

interface ReceiptStripProps {
  state: ReceiptState;
  /** Called with the strip's natural height (canvas units) whenever it changes. */
  onMeasure?: (height: number) => void;
  /** Animate length changes. Off for print renders. */
  animate?: boolean;
}

export function ReceiptStrip({ state, onMeasure, animate = true }: ReceiptStripProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const update = () => {
      const h = el.offsetHeight;
      setHeight(h);
      onMeasure?.(h);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [onMeasure]);

  const seed = `${state.bib}-${state.raceDate}`;
  const clipPath = useMemo(() => tornEdgePolygon(seed), [seed]);

  const kind = receiptKind(state);
  const finish = finishSeconds(state);
  const showTimes = state.timeBlock.mode === "times";
  const spot = SPOT_INKS[state.print.spotInk].hex;
  const heroText = kind === "finished" && finish !== null ? formatTime(finish).replace(/^0/, "") : formatShortDate(state.raceDate);
  const totalQty = state.items.reduce((sum, item) => sum + item.qty, 0);
  const unitLabel = state.units.toUpperCase();

  // Splits the form flags (unreadable or out of order) stay off the receipt until fixed.
  const badSplits = new Set(validateSplits(state).map((issue) => issue.key));
  const splitRows = [
    ...SPLITS.map((s) => ({ key: s.key, label: s.label, km: s.km, secs: parseTime(state.timeBlock.splits[s.key]) })),
    { key: "finish" as const, label: "FINISH", km: MARATHON_KM, secs: finish },
  ].filter(
    (row): row is typeof row & { secs: number } => row.secs !== null && !badSplits.has(row.key),
  );

  const shellStyle: CSSProperties = {
    width: CANVAS.stripWidth,
    height: height ?? "auto",
    clipPath,
    transition: animate ? "height 220ms cubic-bezier(0.2, 0.7, 0.2, 1)" : undefined,
  };

  return (
    <div className="relative overflow-hidden bg-paper text-ink" style={shellStyle}>
      <div
        ref={contentRef}
        className="font-mono text-[14px] leading-[20px] [overflow-wrap:anywhere]"
        style={{ padding: `${TOOTH_DEPTH + 26}px ${PAD_X}px ${TOOTH_DEPTH + 28}px` }}
      >
        {/* Header */}
        <SmallCaps className="text-center">Race Receipt</SmallCaps>
        <div className="mt-[10px] text-center text-[23px] leading-[28px] font-bold uppercase">
          {state.raceTitle || "Your Race"}
        </div>
        <div className="mt-[4px] text-center text-[12px] leading-[16px] uppercase">
          {[state.city, formatReceiptDate(state.raceDate)].filter(Boolean).join("  ·  ")}
        </div>
        <div className="mt-[8px] flex justify-between text-[11px] leading-[16px] uppercase">
          <span>Store 0042 · Reg 01</span>
          <span>Bib #{state.bib || "----"}</span>
        </div>

        <Hazard />

        {/* Hero: dithered photo or dotted route, with the big number breaking the grid */}
        {state.hero.kind !== "none" && (
          <div className="relative" style={{ height: HERO_H }}>
            {state.hero.kind === "photo" && state.hero.photo ? (
              // eslint-disable-next-line @next/next/no-img-element -- in-memory data URL
              <img
                src={state.hero.photo.dataUrl}
                alt="Dithered finish-line photo"
                width={INNER}
                height={HERO_H}
                className="block"
                style={{ imageRendering: "pixelated", width: INNER, height: HERO_H }}
              />
            ) : state.hero.kind === "photo" ? (
              <div className="flex h-full items-center justify-center border-2 border-dashed border-current text-center text-[11px] uppercase opacity-60">
                Your finish-line photo
                <br />
                prints here
              </div>
            ) : (
              <RouteMap source={state.hero.route} width={INNER} height={HERO_H} />
            )}
          </div>
        )}
        <div
          aria-label={kind === "finished" ? `Finish time ${heroText}` : `Race date ${heroText}`}
          className="relative font-display font-light tracking-[-0.03em] whitespace-nowrap"
          style={{
            fontSize: heroFontSize(heroText),
            lineHeight: 0.9,
            color: spot,
            mixBlendMode: "multiply",
            marginTop: state.hero.kind === "none" ? 4 : -Math.round(heroFontSize(heroText) * 0.42),
            transform: `translate(${IMPERFECTION.misregistration.x}px, ${IMPERFECTION.misregistration.y}px)`,
          }}
        >
          {heroText}
        </div>

        {/* Race details */}
        <div className="mt-[12px] space-y-[2px] uppercase">
          <Leader label="Runner" value={state.runnerName || "—"} />
          <Leader label="Date" value={formatReceiptDate(state.raceDate) || "—"} />
          {state.city && <Leader label="City" value={state.city} />}
          <Leader label="Distance" value={formatDistance(MARATHON_KM, state.units)} />
          {showTimes && finish !== null && (
            <>
              <Leader label="Finish" value={formatTime(finish)} strong />
              <Leader label="Pace" value={`${formatPace(finish, MARATHON_KM, state.units)} /${unitLabel}`} />
            </>
          )}
          {showTimes && finish === null && <Leader label="Status" value="On course" strong />}
        </div>

        <Dashed />

        {/* Items */}
        <div className="flex justify-between text-[11px] leading-[16px] uppercase opacity-80">
          <span>Item</span>
          <span>Qty</span>
        </div>
        <div className="mt-[4px] uppercase">
          {state.items.length === 0 && <div className="text-center text-[12px] opacity-60">(no items)</div>}
          {state.items.map((item) => (
            <Fragment key={item.id}>
              <div className="pt-[2px]">
                <Leader label={item.name || "Item"} value={item.qty} />
              </div>
              {item.detail && <div className="pl-[16px] text-[12px] leading-[16px] opacity-80">↳ {item.detail}</div>}
            </Fragment>
          ))}
        </div>
        <Dashed />
        <div className="space-y-[2px] uppercase">
          <Leader label="Items" value={state.items.length} />
          <Leader label="Total qty" value={totalQty} />
          <Leader label="Balance due" value="0.00" strong />
        </div>

        {/* Time block: times, a mantra, a quip, or nothing */}
        {showTimes && state.timeBlock.showSplits && splitRows.length > 0 && (
          <>
            <Hazard />
            <SmallCaps className="mb-[6px] text-center">{kind === "finished" ? "Splits" : "Goal splits"}</SmallCaps>
            <div className="grid grid-cols-[1fr_auto_auto] gap-x-[14px] uppercase">
              {splitRows.map((row) => (
                <Fragment key={row.label}>
                  <span>{row.label}</span>
                  <span className="text-right tabular-nums">{formatTime(row.secs)}</span>
                  <span className="text-right text-[12px] opacity-80">
                    {formatPace(row.secs, row.km, state.units)}/{unitLabel}
                  </span>
                </Fragment>
              ))}
            </div>
          </>
        )}
        {showTimes && kind === "race-day" && (
          <div className="mt-[12px] text-center text-[12px] uppercase">*** Good luck out there ***</div>
        )}
        {(state.timeBlock.mode === "mantra" || state.timeBlock.mode === "quip") && (
          <>
            <Hazard />
            <SmallCaps className="text-center">{state.timeBlock.mode === "mantra" ? "Today's mantra" : "Cashier's note"}</SmallCaps>
            <div className="mt-[6px] border-2 border-dashed border-current px-[10px] py-[8px] text-center text-[17px] leading-[23px] font-bold uppercase">
              {(state.timeBlock.mode === "mantra" ? state.timeBlock.mantra : state.timeBlock.quip) || "…"}
            </div>
          </>
        )}

        <Hazard />

        {/* Footer */}
        {state.footerNote && (
          <div className="text-center text-[16px] leading-[22px] font-bold uppercase">{state.footerNote}</div>
        )}
        <div className="mt-[16px] flex flex-col items-center">
          <Barcode value={barcodePayload(state.bib, state.raceDate)} width={290} height={58} />
          <div className="mt-[4px] text-[11px] leading-[14px] tracking-[0.3em]">
            {barcodePayload(state.bib, state.raceDate)}
          </div>
        </div>
        <p className="mt-[14px] text-center text-[9px] leading-[13px] uppercase opacity-80">
          No refunds on miles run. Keep this receipt for bragging rights. Results unofficial. Thank you for
          running with us.
        </p>
      </div>
      <PaperTexture seed={seed} />
    </div>
  );
}
