import "server-only";

import { crc32 } from "node:zlib";
import { chromium, type Browser } from "playwright";
import { renderBaseUrl } from "./env";
import { renderSignature } from "./render-token";
import { PRINT_SIZES } from "../print-sizes";
import type { PrintSize } from "../receipt-state";

export const PRINT_DPI = 300;

/** Pixel size of the print file: 8×10 → 2400×3000, 11×14 → 3300×4200, 12×18 → 3600×5400. */
export function printPixels(size: PrintSize) {
  const { widthIn, heightIn } = PRINT_SIZES[size];
  return { width: Math.round(widthIn * PRINT_DPI), height: Math.round(heightIn * PRINT_DPI) };
}

/** Adds a pHYs chunk so image software reads the file as 300 DPI. */
export function withDpi(png: Buffer, dpi = PRINT_DPI): Buffer {
  const pixelsPerMetre = Math.round(dpi / 0.0254);
  const data = Buffer.alloc(9);
  data.writeUInt32BE(pixelsPerMetre, 0);
  data.writeUInt32BE(pixelsPerMetre, 4);
  data.writeUInt8(1, 8); // unit: metre
  const type = Buffer.from("pHYs", "ascii");
  const chunk = Buffer.alloc(4 + 4 + 9 + 4);
  chunk.writeUInt32BE(9, 0);
  type.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([type, data])), 17);
  const afterIhdr = 8 + 25; // signature + IHDR chunk
  return Buffer.concat([png.subarray(0, afterIhdr), chunk, png.subarray(afterIhdr)]);
}

let browser: Browser | null = null;

/**
 * Playwright's bundled Chromium (`npx playwright install chromium`), or an
 * installed Google Chrome when that's missing or RENDER_BROWSER_CHANNEL=chrome.
 */
async function launch(channel?: string): Promise<Browser> {
  // A first launch occasionally stalls on macOS; fail fast and try once more.
  for (let attempt = 1; ; attempt++) {
    try {
      return await chromium.launch({ ...(channel ? { channel } : {}), timeout: 30_000 });
    } catch (err) {
      if (attempt >= 2 || !/Timeout/i.test(String(err))) throw err;
    }
  }
}

async function getBrowser(): Promise<Browser> {
  if (browser?.isConnected()) return browser;
  const channel = process.env.RENDER_BROWSER_CHANNEL?.trim();
  try {
    browser = await launch(channel);
  } catch (err) {
    if (channel || !/Executable doesn't exist/i.test(String(err))) throw err;
    browser = await launch("chrome");
  }
  return browser;
}

export async function closeBrowser() {
  await browser?.close();
  browser = null;
}

/** The render page lays the print out at 100 CSS px per inch, so every size has whole-pixel dimensions. */
export const RENDER_CSS_PX_PER_INCH = 100;

/**
 * Screenshots the signed /render page at full print resolution: the page is
 * sized at 100 CSS px per inch and captured at device scale 3, which is 300 DPI.
 */
export async function renderPrint(receiptId: string, size: PrintSize): Promise<Buffer> {
  const { widthIn, heightIn } = PRINT_SIZES[size];
  const viewport = { width: widthIn * RENDER_CSS_PX_PER_INCH, height: heightIn * RENDER_CSS_PX_PER_INCH };

  const context = await (await getBrowser()).newContext({
    viewport,
    deviceScaleFactor: PRINT_DPI / RENDER_CSS_PX_PER_INCH,
  });
  try {
    const page = await context.newPage();
    const url = `${renderBaseUrl()}/render/${encodeURIComponent(receiptId)}?sig=${renderSignature(receiptId)}`;
    const response = await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
    if (!response?.ok()) throw new Error(`Render page returned HTTP ${response?.status()}`);
    await page.waitForSelector('[data-render-ready="true"]', { timeout: 30_000 });
    // Never let page chrome into a print file (e.g. the Next.js dev-mode indicator).
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    const fitStatus = await page.getAttribute("[data-render-ready]", "data-fit-status");
    if (fitStatus === "too-long") throw new Error("Receipt is too long for this print size");
    const png = await page.screenshot({ type: "png", clip: { x: 0, y: 0, ...viewport } });
    return withDpi(png);
  } finally {
    await context.close();
  }
}

/** Reads width × height from a PNG header. */
export function pngSize(png: Buffer) {
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}
