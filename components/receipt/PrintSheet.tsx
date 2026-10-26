import type { CSSProperties, ReactNode } from "react";
import { availableStripHeight, CANVAS, FRAME_COLORS, sheetHeight, type Fit } from "@/lib/print-sizes";
import type { ReceiptState } from "@/lib/receipt-state";
import { useSvgId } from "../useSvgId";

const FRAME_W = 44;
const MAT_W = 120;

/** Total size in canvas units of the sheet plus any frame and mat around it. */
export function sheetOuterSize(print: ReceiptState["print"], withFrame: boolean) {
  const ring = withFrame ? (print.frame !== "none" ? FRAME_W : 0) + (print.frame === "frame-mat" ? MAT_W : 0) : 0;
  return { width: CANVAS.sheetWidth + ring * 2, height: sheetHeight(print.size) + ring * 2 };
}

interface PrintSheetProps {
  print: ReceiptState["print"];
  fit: Fit;
  /** The strip's natural height in canvas units. */
  stripHeight: number;
  withFrame: boolean;
  watermark?: boolean;
  animate?: boolean;
  children: ReactNode;
}

/**
 * The print: a backing sheet at the chosen size with the receipt strip mounted
 * on it, optionally inside a frame and mat. Sizes are the sheet size; frame
 * and mat sit around it.
 */
export function PrintSheet({ print, fit, stripHeight, withFrame, watermark, animate = true, children }: PrintSheetProps) {
  const sheetH = sheetHeight(print.size);
  const stripW = CANVAS.stripWidth * fit.scale;
  const stripH = stripHeight * fit.scale;
  const top = Math.max(CANVAS.sheetMarginY, (sheetH - Math.min(stripH, availableStripHeight(print.size))) / 2);
  const transition = animate ? "top 220ms cubic-bezier(0.2, 0.7, 0.2, 1), transform 220ms ease" : undefined;

  const sheet = (
    <div
      className="relative overflow-hidden bg-sheet"
      style={{
        width: CANVAS.sheetWidth,
        height: sheetH,
        boxShadow: withFrame && print.frame === "frame-mat" ? "0 0 0 5px #fbfaf6, inset 0 2px 6px rgba(42,32,25,0.18)" : undefined,
      }}
    >
      <div
        className="absolute"
        style={{
          left: (CANVAS.sheetWidth - stripW) / 2,
          top,
          transform: `scale(${fit.scale})`,
          transformOrigin: "top left",
          filter: "drop-shadow(0 5px 8px rgba(42,32,25,0.16)) drop-shadow(0 1px 1px rgba(42,32,25,0.12))",
          transition,
        }}
      >
        {children}
      </div>
      {watermark && <Watermark />}
    </div>
  );

  if (!withFrame || print.frame === "none") {
    return withFrame ? <div style={{ boxShadow: "0 18px 40px -18px rgba(42,32,25,0.45)" }}>{sheet}</div> : sheet;
  }

  const frameHex = FRAME_COLORS[print.frameColor].hex;
  const frameStyle: CSSProperties = {
    padding: FRAME_W,
    background:
      print.frameColor === "oak"
        ? `repeating-linear-gradient(90deg, rgba(0,0,0,0.05) 0 3px, transparent 3px 11px), ${frameHex}`
        : frameHex,
    boxShadow:
      "inset 0 0 0 1px rgba(0,0,0,0.25), inset 6px 6px 10px rgba(255,255,255,0.12), inset -6px -6px 12px rgba(0,0,0,0.25), 0 24px 50px -20px rgba(42,32,25,0.55)",
  };

  return (
    <div style={frameStyle}>
      <div style={{ boxShadow: "inset 3px 3px 8px rgba(0,0,0,0.35)" }}>
        {print.frame === "frame-mat" ? (
          <div style={{ padding: MAT_W, background: "#f8f6f0", boxShadow: "inset 2px 2px 6px rgba(0,0,0,0.18)" }}>
            {sheet}
          </div>
        ) : (
          sheet
        )}
      </div>
    </div>
  );
}

function Watermark() {
  const id = useSvgId("watermark");
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
      <defs>
        <pattern id={id} width="540" height="120" patternUnits="userSpaceOnUse" patternTransform="rotate(-28)">
          <text x="30" y="70" fontFamily="var(--font-mono)" fontSize="26" letterSpacing="6" fill="#2a2019" opacity="0.16">
            PROOF · NOT FOR PRINT
          </text>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}
