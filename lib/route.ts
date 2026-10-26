// Route sources. Every source resolves to points normalised into a 0–1 box, so
// a course library, a drawn route or a GPX upload can plug in later by adding
// an adapter here; RouteMap only ever sees normalised points.

export interface Point {
  x: number;
  y: number;
}

export type RouteSource =
  | { kind: "sample" }
  | { kind: "library"; courseId: string }
  | { kind: "drawn"; points: Point[] }
  | { kind: "gpx"; points: Point[]; fileName?: string };

/** A made-up city course (x = east, y = north): a lakefront loop with out-and-backs, laid out landscape. */
const SAMPLE_COURSE: Point[] = ([
  { x: 50, y: 50 }, { x: 52, y: 58 }, { x: 51, y: 68 }, { x: 54, y: 78 }, { x: 50, y: 88 },
  { x: 44, y: 94 }, { x: 38, y: 90 }, { x: 40, y: 80 }, { x: 37, y: 70 }, { x: 40, y: 60 },
  { x: 44, y: 54 }, { x: 36, y: 50 }, { x: 26, y: 52 }, { x: 18, y: 48 }, { x: 16, y: 40 },
  { x: 24, y: 38 }, { x: 34, y: 40 }, { x: 42, y: 36 }, { x: 46, y: 28 }, { x: 44, y: 18 },
  { x: 48, y: 10 }, { x: 54, y: 6 }, { x: 58, y: 12 }, { x: 56, y: 22 }, { x: 60, y: 30 },
  { x: 58, y: 38 }, { x: 54, y: 44 }, { x: 52, y: 48 },
] as Point[]).map(({ x, y }) => ({ x: y, y: x }));

/** Placeholder for a future course library; unknown ids fall back to the sample. */
const COURSE_LIBRARY: Record<string, Point[]> = {};

export function rawPoints(source: RouteSource): Point[] {
  switch (source.kind) {
    case "sample":
      return SAMPLE_COURSE;
    case "library":
      return COURSE_LIBRARY[source.courseId] ?? SAMPLE_COURSE;
    case "drawn":
    case "gpx":
      return source.points.length >= 2 ? source.points : SAMPLE_COURSE;
  }
}

/**
 * Fits points into a box of the given aspect ratio (width / height), keeping
 * proportions and flipping y so north is up. Output is in 0–1 on both axes.
 */
export function normalizePoints(points: Point[], aspect = 1.5, padding = 0.08): Point[] {
  if (points.length === 0) return [];
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const spanX = Math.max(...xs) - minX || 1;
  const spanY = Math.max(...ys) - minY || 1;

  // Scale so the route fits inside the padded box in box units (width = aspect, height = 1).
  const innerW = aspect * (1 - 2 * padding);
  const innerH = 1 - 2 * padding;
  const scale = Math.min(innerW / spanX, innerH / spanY);
  const offsetX = (aspect - spanX * scale) / 2;
  const offsetY = (1 - spanY * scale) / 2;

  return points.map((p) => ({
    x: (offsetX + (p.x - minX) * scale) / aspect,
    y: offsetY + (spanY - (p.y - minY)) * scale,
  }));
}

/** SVG path data for normalised points drawn into a width × height box. */
export function toPathData(points: Point[], width: number, height: number): string {
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"}${(p.x * width).toFixed(1)} ${(p.y * height).toFixed(1)}`)
    .join(" ");
}
