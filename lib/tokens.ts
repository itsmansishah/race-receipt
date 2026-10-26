// Design tokens. Colours are mirrored as CSS
// variables in app/globals.css; the imperfection strengths live here because
// the SVG texture filters read them.

export const INK = "#2a2019"; // warm brown-black, never pure black
export const PAPER = "#f4efe4"; // thermal paper, off-white
export const SHEET = "#ebe5d8"; // backing board the strip is mounted on

export const SPOT_INKS = {
  none: { label: "Ink only", hex: INK },
  red: { label: "Riso red", hex: "#e2432d" },
  blue: { label: "Riso blue", hex: "#2f56b0" },
} as const;

/** Imperfection, on purpose. Kept low enough that the data stays readable. */
export const IMPERFECTION = {
  /** Opacity of dark paper speckle. */
  grain: 0.22,
  /** Opacity of paper-coloured holes punched through the ink. */
  inkGaps: 0.55,
  /** Spot-colour layer offset from the ink layer, in canvas units. */
  misregistration: { x: 2.5, y: -1.5 },
  /** Faint horizontal lines where the "print head" skipped. */
  droppedLines: 3,
  /** Left-to-right density falloff, 0–1. */
  densityFalloff: 0.08,
} as const;

/** Small deterministic PRNG so textures stay the same between renders and prints. */
export function seededRandom(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
