# Race Receipt

A product customizer for personalised, thermal-receipt-style marathon prints. Prototype: customizer, live preview and a placeholder order summary. Payments and fulfilment are not connected.

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # Vitest: state, time, barcode, dither
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

## Plugging in real routes

`RouteSource` is `sample | library | drawn | gpx`. Each resolves to points in
`lib/route.ts`, which `normalizePoints` fits to the hero box. To add a source,
add a case to `rawPoints`. `RouteMap` doesn't change.
