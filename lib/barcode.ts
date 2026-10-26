// Code 128 (subset B) encoder. Pure functions so it is easy to test and can
// run on the server for print renders later.

import { compactDate } from "./time";

/** Bar/space module widths for symbol values 0–106. Each sums to 11 modules (stop: 13). */
export const CODE128_PATTERNS: readonly string[] = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112",
];

const START_B = 104;
const STOP = 106;

export interface Bar {
  /** Offset in modules from the left edge (quiet zone excluded). */
  x: number;
  /** Width in modules. */
  w: number;
}

export interface EncodedBarcode {
  text: string;
  /** Symbol values including start, checksum and stop. */
  codes: number[];
  checksum: number;
  bars: Bar[];
  /** Total width in modules. */
  width: number;
}

/** Keeps only characters Code 128B can encode (ASCII 32–126). */
export function sanitizeForCode128B(text: string): string {
  return Array.from(text)
    .filter((ch) => {
      const c = ch.charCodeAt(0);
      return c >= 32 && c <= 126;
    })
    .join("");
}

export function code128Checksum(values: number[]): number {
  // values[0] is the start code (weight 1); data symbols are weighted by position.
  return values.reduce((sum, v, i) => sum + v * Math.max(1, i), 0) % 103;
}

export function encodeCode128B(input: string): EncodedBarcode {
  const text = sanitizeForCode128B(input);
  const data = Array.from(text).map((ch) => ch.charCodeAt(0) - 32);
  const checksum = code128Checksum([START_B, ...data]);
  const codes = [START_B, ...data, checksum, STOP];

  const bars: Bar[] = [];
  let x = 0;
  for (const code of codes) {
    const pattern = CODE128_PATTERNS[code];
    for (let i = 0; i < pattern.length; i++) {
      const w = Number(pattern[i]);
      if (i % 2 === 0) bars.push({ x, w }); // even positions are bars, odd are spaces
      x += w;
    }
  }
  return { text, codes, checksum, bars, width: x };
}

/** Barcode payload: bib + race date, e.g. "40123-20261011". */
export function barcodePayload(bib: string, raceDate: string): string {
  const cleanBib = sanitizeForCode128B(bib.trim().toUpperCase()) || "0000";
  const date = compactDate(raceDate) || "00000000";
  return `${cleanBib}-${date}`;
}
