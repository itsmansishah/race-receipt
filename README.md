# Race Receipt

A product customizer for personalised, thermal-receipt-style marathon prints, with Shopify checkout. Buyers design a receipt, pay on Shopify's hosted checkout, and a worker renders the 300 DPI print file. Fulfilment is a stub.

**Setting up Shopify and placing a test order:** [docs/shopify-setup.md](docs/shopify-setup.md)

```bash
npm install
npm run dev        # http://localhost:3000
npm run worker     # renders paid receipts (needs `npx playwright install chromium` once)
npm test           # Vitest: state, time, barcode, dither, HMAC, webhook dedupe, receipt lookup
npm run typecheck
npm run lint
```

## Structure

```
app/
  page.tsx              customizer
  print/page.tsx        watermarked proof at true physical size (print / save as PDF)
  fonts/                Space Mono + Space Grotesk, self-hosted (OFL)
components/
  Customizer.tsx        layout, sticky order bar, fit state
  CustomizerForm.tsx    form sections 01–07
  ReceiptItemManager.tsx  add / edit / reorder (drag, keyboard, arrows) / delete, 15-item cap
  ReceiptPreview.tsx    "Receipt" and "On the wall" views, fit-to-size warnings
  receipt/ReceiptStrip.tsx  the receipt itself (shared by preview and proof)
  receipt/PrintSheet.tsx    backing sheet, frame, mat, watermark
  receipt/PaperTexture.tsx  grain, ink gaps, dropped lines (SVG, generated)
  Barcode.tsx           Code 128B as SVG
  RouteMap.tsx          dotted route on a dot grid
  PhotoDropzone.tsx     consent, upload, live dithering
lib/
  receipt-state.ts      the single typed ReceiptState, reducer, validation
  time.ts  barcode.ts  dither.ts  route.ts  print-sizes.ts  persistence.ts  tokens.ts
```

## How the preview stays honest

The receipt is laid out once in canvas units (sheet = 1000u wide, strip = 380u).
After every change the strip's natural height is measured. If it is taller than
the sheet allows, the strip is scaled down to fit and a warning is shown; below
75% checkout is blocked. The preview and `/print` render the same components,
so the proof matches the preview.

## Checkout flow

1. **Secure checkout** posts the design to `POST /api/checkout`. The server saves it (SQLite), keeps the dithered photo in `storage/`, finds the Shopify variant for the size and finish, and calls `cartCreate` with the Headless channel's private token. Only the receipt ID goes to Shopify, as the line attribute `_receipt_id`.
2. The browser does a full-page redirect to the cart's `checkoutUrl`. Shopify takes payment and tax.
3. Shopify sends `orders/paid` to `/api/webhooks/shopify/orders-paid`. The handler verifies the HMAC on the raw body (constant-time), skips repeat deliveries by `X-Shopify-Webhook-Id`, marks the receipt paid, queues a render job and returns 200.
4. `npm run worker` screenshots the signed internal `/render/[id]` page with headless Chromium at print size × 300 DPI, writes the PNG and a packing slip, and calls the fulfilment stub (`lib/server/fulfillment.ts`).

Server code lives in `lib/server/` (marked `server-only`); secrets are read only from environment variables there.

## Plugging in real routes

`RouteSource` is `sample | library | drawn | gpx`. Each resolves to points in
`lib/route.ts`, which `normalizePoints` fits to the hero box. To add a source,
add a case to `rawPoints`. `RouteMap` doesn't change.
