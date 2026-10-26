import { memo } from "react";
import { encodeCode128B } from "@/lib/barcode";

const QUIET_ZONE = 10; // modules each side, per the Code 128 spec

interface BarcodeProps {
  value: string;
  /** Rendered width and height in canvas units. */
  width: number;
  height: number;
  color?: string;
  className?: string;
}

/** A scannable Code 128B barcode drawn as crisp SVG rects. */
export const Barcode = memo(function Barcode({ value, width, height, color = "currentColor", className }: BarcodeProps) {
  const { bars, width: modules, text } = encodeCode128B(value);
  const total = modules + QUIET_ZONE * 2;
  return (
    <svg
      className={className}
      width={width}
      height={height}
      viewBox={`0 0 ${total} 100`}
      preserveAspectRatio="none"
      shapeRendering="crispEdges"
      role="img"
      aria-label={`Barcode ${text}`}
    >
      {bars.map((bar) => (
        <rect key={bar.x} x={bar.x + QUIET_ZONE} y={0} width={bar.w} height={100} fill={color} />
      ))}
    </svg>
  );
});
