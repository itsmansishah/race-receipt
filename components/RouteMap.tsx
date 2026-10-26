import { memo, useMemo } from "react";
import { useSvgId } from "./useSvgId";
import { normalizePoints, rawPoints, toPathData, type RouteSource } from "@/lib/route";

interface RouteMapProps {
  source: RouteSource;
  width: number;
  height: number;
  color?: string;
}

/**
 * The route drawn the thermal way: a dotted line on a dot grid. It renders
 * whatever RouteSource resolves to, so new sources need no changes here.
 */
export const RouteMap = memo(function RouteMap({ source, width, height, color = "currentColor" }: RouteMapProps) {
  const points = useMemo(() => normalizePoints(rawPoints(source), width / height), [source, width, height]);
  const path = toPathData(points, width, height);
  const start = points[0];
  const end = points[points.length - 1];
  const grid = 14;
  const gridId = useSvgId("route-grid");

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Course map">
      <defs>
        <pattern id={gridId} width={grid} height={grid} patternUnits="userSpaceOnUse">
          <circle cx={grid / 2} cy={grid / 2} r={0.9} fill={color} opacity={0.35} />
        </pattern>
      </defs>
      <rect width={width} height={height} fill={`url(#${gridId})`} />
      {/* Paper halo so the route reads over the grid */}
      <path d={path} fill="none" stroke="var(--paper)" strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" />
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={4.2}
        strokeDasharray="0.1 7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {start && (
        <g fill={color} fontFamily="var(--font-mono)" fontSize={10} letterSpacing="0.2em">
          <rect x={start.x * width - 5} y={start.y * height - 5} width={10} height={10} />
          <text x={start.x * width + 10} y={start.y * height + 4}>
            START
          </text>
        </g>
      )}
      {end && (
        <g fill="none" stroke={color} strokeWidth={2}>
          <circle cx={end.x * width} cy={end.y * height} r={6} />
        </g>
      )}
    </svg>
  );
});
