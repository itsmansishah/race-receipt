import { memo, useMemo } from "react";
import { INK, IMPERFECTION, PAPER, seededRandom } from "@/lib/tokens";
import { useSvgId } from "../useSvgId";

function hexToUnit(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
}

/** Builds a feColorMatrix that turns noise into sparse specks of one colour. */
function speckMatrix(hex: string, slope: number, threshold: number): string {
  const [r, g, b] = hexToUnit(hex);
  return `0 0 0 0 ${r}  0 0 0 0 ${g}  0 0 0 0 ${b}  ${slope} 0 0 0 ${-slope * threshold}`;
}

/**
 * Overlay that makes the strip read as printed thermal paper: dark speckle,
 * paper-coloured gaps in the ink, a few dropped print-head lines and uneven
 * density. Generated in SVG so it re-renders at any print size.
 */
export const PaperTexture = memo(function PaperTexture({ seed }: { seed: string }) {
  const grainId = useSvgId("grain");
  const gapsId = useSvgId("gaps");
  const fadeId = useSvgId("fade");

  const droppedLines = useMemo(() => {
    const rand = seededRandom(seed);
    return Array.from({ length: IMPERFECTION.droppedLines }, () => ({
      y: 18 + rand() * 70, // percent down the strip
      opacity: 0.45 + rand() * 0.35,
    }));
  }, [seed]);

  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
      <defs>
        <filter id={grainId} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={7} />
          <feColorMatrix type="matrix" values={speckMatrix(INK, 14, 0.66)} />
        </filter>
        <filter id={gapsId} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves={1} seed={23} />
          <feColorMatrix type="matrix" values={speckMatrix(PAPER, 16, 0.62)} />
        </filter>
        <linearGradient id={fadeId} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor={PAPER} stopOpacity={IMPERFECTION.densityFalloff * 3} />
          <stop offset="0.35" stopColor={PAPER} stopOpacity={0} />
          <stop offset="1" stopColor={PAPER} stopOpacity={IMPERFECTION.densityFalloff} />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${fadeId})`} />
      <rect width="100%" height="100%" filter={`url(#${gapsId})`} opacity={IMPERFECTION.inkGaps} />
      {droppedLines.map((line, i) => (
        <rect key={i} x="0" y={`${line.y}%`} width="100%" height="1.2" fill={PAPER} opacity={line.opacity} />
      ))}
      <rect width="100%" height="100%" filter={`url(#${grainId})`} opacity={IMPERFECTION.grain} />
    </svg>
  );
});
