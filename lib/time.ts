// Time helpers. Times live in state as the string the buyer typed so inputs
// never fight the cursor; everything here parses or formats on the way out.

export const MARATHON_KM = 42.195;
export const KM_PER_MILE = 1.609344;

export type Units = "mi" | "km";

/**
 * Parses "HH:MM:SS" or "H:MM:SS". Returns seconds, or null if invalid/blank.
 * Partial input like "3:42" is deliberately invalid so the receipt doesn't
 * flash a 3-minute marathon while someone is still typing.
 */
export function parseTime(input: string): number | null {
  const match = /^(\d{1,2}):(\d{2}):(\d{2})$/.exec(input.trim());
  if (!match) return null;
  const [h, m, s] = match.slice(1).map(Number);
  if (m > 59 || s > 59) return null;
  return h * 3600 + m * 60 + s;
}

/** Formats seconds as HH:MM:SS. */
export function formatTime(totalSeconds: number): string {
  const sec = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

/**
 * Cleans up a typed time on blur: "3:42:18" → "03:42:18", "34218" → "03:42:18".
 * Returns null when the input can't be read as a time, "" when blank.
 */
export function normalizeTimeInput(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return "";
  if (/^\d{3,6}$/.test(trimmed)) {
    const padded = trimmed.padStart(6, "0");
    const joined = `${padded.slice(0, 2)}:${padded.slice(2, 4)}:${padded.slice(4, 6)}`;
    const secs = parseTime(joined);
    return secs === null ? null : formatTime(secs);
  }
  // "25:30" on its own reads as MM:SS.
  const secs = parseTime(/^\d{1,2}:\d{2}$/.test(trimmed) ? `0:${trimmed}` : trimmed);
  return secs === null ? null : formatTime(secs);
}

/** Pace per mile or km, formatted "M:SS". */
export function formatPace(totalSeconds: number, distanceKm: number, units: Units): string {
  const distance = units === "km" ? distanceKm : distanceKm / KM_PER_MILE;
  const perUnit = Math.round(totalSeconds / distance);
  const m = Math.floor(perUnit / 60);
  const s = perUnit % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatDistance(distanceKm: number, units: Units): string {
  const value = units === "km" ? distanceKm : distanceKm / KM_PER_MILE;
  return `${value.toFixed(1)} ${units.toUpperCase()}`;
}

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** "2026-10-11" → { y, m, d } without timezone drift. */
export function parseIsoDate(iso: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const [y, m, d] = match.slice(1).map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return { y, m, d };
}

/** "2026-10-11" → "OCT 11 2026" */
export function formatReceiptDate(iso: string): string {
  const p = parseIsoDate(iso);
  if (!p) return "";
  return `${MONTHS[p.m - 1]} ${String(p.d).padStart(2, "0")} ${p.y}`;
}

/** "2026-10-11" → "10.11.26" for the hero number. */
export function formatShortDate(iso: string): string {
  const p = parseIsoDate(iso);
  if (!p) return "";
  return `${String(p.m).padStart(2, "0")}.${String(p.d).padStart(2, "0")}.${String(p.y).slice(2)}`;
}

/** "2026-10-11" → "20261011" for the barcode. */
export function compactDate(iso: string): string {
  const p = parseIsoDate(iso);
  if (!p) return "";
  return `${p.y}${String(p.m).padStart(2, "0")}${String(p.d).padStart(2, "0")}`;
}
