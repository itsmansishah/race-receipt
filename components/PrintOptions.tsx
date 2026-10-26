"use client";

import { Check } from "lucide-react";
import { useReceipt, useReceiptDispatch } from "./ReceiptProvider";
import { Segmented } from "./ui";
import { FRAME_COLORS, FRAME_OPTIONS, formatPrice, PRINT_SIZES } from "@/lib/print-sizes";
import type { FrameColor, FrameOption, PrintSize, SpotInk } from "@/lib/receipt-state";
import { SPOT_INKS } from "@/lib/tokens";

export function PrintOptions() {
  const { print } = useReceipt();
  const dispatch = useReceiptDispatch();

  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Size</legend>
        <div role="radiogroup" aria-label="Print size" className="grid grid-cols-3 gap-2">
          {(Object.keys(PRINT_SIZES) as PrintSize[]).map((size) => {
            const s = PRINT_SIZES[size];
            const active = print.size === size;
            return (
              <button
                key={size}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => dispatch({ type: "setPrint", patch: { size } })}
                className={`relative flex flex-col items-center gap-2 rounded-lg border p-3 transition-colors ${
                  active ? "border-ink bg-white/70" : "border-line hover:border-ink"
                }`}
              >
                <span
                  aria-hidden
                  className="block border border-ink/60 bg-sheet"
                  style={{ width: s.widthIn * 2.6, height: s.heightIn * 2.6 }}
                />
                <span className="text-sm font-medium">{s.label}</span>
                <span className="font-mono text-xs text-ink-soft">{formatPrice(s.price)}</span>
                {active && <Check size={14} className="absolute top-2 right-2" aria-hidden />}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Finish</legend>
        <Segmented
          label="Finish"
          value={print.frame}
          options={(Object.keys(FRAME_OPTIONS) as FrameOption[]).map((value) => ({
            value,
            label: `${FRAME_OPTIONS[value].label}${FRAME_OPTIONS[value].price ? ` +$${FRAME_OPTIONS[value].price}` : ""}`,
          }))}
          onChange={(frame) => dispatch({ type: "setPrint", patch: { frame } })}
        />
      </fieldset>

      {print.frame !== "none" && (
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Frame colour</legend>
          <Segmented
            label="Frame colour"
            value={print.frameColor}
            options={(Object.keys(FRAME_COLORS) as FrameColor[]).map((value) => ({
              value,
              label: FRAME_COLORS[value].label,
              icon: (
                <span
                  aria-hidden
                  className="h-3.5 w-3.5 rounded-full border border-ink/30"
                  style={{ background: FRAME_COLORS[value].hex }}
                />
              ),
            }))}
            onChange={(frameColor) => dispatch({ type: "setPrint", patch: { frameColor } })}
          />
        </fieldset>
      )}

      <fieldset>
        <legend className="mb-1 text-sm font-medium">Second ink</legend>
        <p className="mb-2 text-xs text-ink-soft">A riso spot colour, used only on the big date or finish time.</p>
        <Segmented
          label="Second ink"
          value={print.spotInk}
          options={(Object.keys(SPOT_INKS) as SpotInk[]).map((value) => ({
            value,
            label: SPOT_INKS[value].label,
            icon: <span aria-hidden className="h-3.5 w-3.5 rounded-full" style={{ background: SPOT_INKS[value].hex }} />,
          }))}
          onChange={(spotInk) => dispatch({ type: "setPrint", patch: { spotInk } })}
        />
      </fieldset>
    </div>
  );
}
