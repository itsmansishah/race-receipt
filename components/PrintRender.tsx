"use client";

import { useEffect, useState } from "react";
import { PrintSheet } from "./receipt/PrintSheet";
import { ReceiptStrip } from "./receipt/ReceiptStrip";
import { useStripFit } from "./receipt/useStripFit";
import { CANVAS, PRINT_SIZES } from "@/lib/print-sizes";
import type { ReceiptState } from "@/lib/receipt-state";

/** Matches RENDER_CSS_PX_PER_INCH in lib/server/render.ts. */
const CSS_PX_PER_INCH = 100;

/**
 * The print file's source: the same sheet and strip as the preview and proof,
 * unframed and unwatermarked, scaled to 100 CSS px per inch. Sets data-render-ready once the
 * strip is measured and fonts and images have loaded, so the renderer knows
 * when to take the screenshot.
 */
export function PrintRender({ state }: { state: ReceiptState }) {
  const { fit, naturalHeight, onMeasure } = useStripFit(state.print.size);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (naturalHeight <= 0) return;
    let cancelled = false;
    const images = Array.from(document.images).map((img) => img.decode().catch(() => undefined));
    Promise.all([document.fonts.ready, ...images]).then(() => {
      requestAnimationFrame(() => !cancelled && setReady(true));
    });
    return () => {
      cancelled = true;
    };
  }, [naturalHeight]);

  return (
    <div
      data-render-ready={ready}
      data-fit-status={fit.status}
      className="absolute top-0 left-0"
      style={{ transform: `scale(${(PRINT_SIZES[state.print.size].widthIn * CSS_PX_PER_INCH) / CANVAS.sheetWidth})`, transformOrigin: "top left" }}
    >
      <PrintSheet print={state.print} fit={fit} stripHeight={naturalHeight} withFrame={false} animate={false}>
        <ReceiptStrip state={state} onMeasure={onMeasure} animate={false} />
      </PrintSheet>
    </div>
  );
}
