"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ImageUp, Trash2 } from "lucide-react";
import { useReceipt, useReceiptDispatch } from "./ReceiptProvider";
import { Segmented } from "./ui";
import { dither, DITHER_LABELS, maskToRgba, THERMAL_DOTS, toGrayscale, type DitherAlgo } from "@/lib/dither";
import { INK } from "@/lib/tokens";

const OUT_W = THERMAL_DOTS;
const OUT_H = Math.round((THERMAL_DOTS * 2) / 3); // matches the 3:2 hero box

/** Crops `source` to 3:2 (cover), dithers it at thermal resolution and returns a PNG data URL. */
function renderDithered(source: ImageBitmap, algo: DitherAlgo, brightness: number, contrast: number): string {
  const canvas = document.createElement("canvas");
  canvas.width = OUT_W;
  canvas.height = OUT_H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const scale = Math.max(OUT_W / source.width, OUT_H / source.height);
  const w = source.width * scale;
  const h = source.height * scale;
  ctx.drawImage(source, (OUT_W - w) / 2, (OUT_H - h) / 2, w, h);
  const { data } = ctx.getImageData(0, 0, OUT_W, OUT_H);
  const mask = dither(toGrayscale(data, OUT_W, OUT_H, { brightness, contrast }), OUT_W, OUT_H, algo);
  ctx.putImageData(new ImageData(maskToRgba(mask, INK), OUT_W, OUT_H), 0, 0);
  return canvas.toDataURL("image/png");
}

/**
 * Finish-line photo step. The original only lives in memory while the page is
 * open; just the 1-bit dithered version is kept, and never on a server.
 */
export function PhotoDropzone() {
  const { hero } = useReceipt();
  const dispatch = useReceiptDispatch();
  const source = useRef<ImageBitmap | null>(null);
  const [hasSource, setHasSource] = useState(false);
  const [consent, setConsent] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string>();
  const [brightness, setBrightness] = useState(10);
  const [contrast, setContrast] = useState(20);
  const consentId = useId();
  const inputId = useId();

  const redraw = useCallback(() => {
    if (!source.current) return;
    const dataUrl = renderDithered(source.current, hero.dither, brightness, contrast);
    dispatch({ type: "setHero", patch: { photo: { dataUrl, width: OUT_W, height: OUT_H } } });
  }, [hero.dither, brightness, contrast, dispatch]);

  // Re-dither on the next frame when a setting changes, so sliders stay smooth.
  useEffect(() => {
    if (!hasSource) return;
    const raf = requestAnimationFrame(redraw);
    return () => cancelAnimationFrame(raf);
  }, [redraw, hasSource]);

  const loadFile = async (file: File | undefined) => {
    setError(undefined);
    if (!file) return;
    if (!consent) {
      setError("Please confirm you have the right to use this photo first.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("That file isn't an image. Try a JPG, PNG or HEIC exported as JPG.");
      return;
    }
    try {
      source.current?.close();
      source.current = await createImageBitmap(file);
      setHasSource(true);
      redraw();
    } catch {
      setError("We couldn't read that image. Try a different file.");
    }
  };

  const clear = () => {
    source.current?.close();
    source.current = null;
    setHasSource(false);
    dispatch({ type: "setHero", patch: { photo: null } });
  };

  return (
    <div className="space-y-3">
      <label htmlFor={consentId} className="flex cursor-pointer items-start gap-2.5 text-sm">
        <input
          id={consentId}
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--ink)]"
        />
        <span>
          I took this photo or have permission to use it, and anyone in it is OK with being printed.
          <span className="block text-xs text-ink-soft">
            Race photographers usually own their photos. We only keep the dotted version, never your original.
          </span>
        </span>
      </label>

      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void loadFile(e.dataTransfer.files[0]);
        }}
        className={`flex min-h-28 flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed p-4 text-center text-sm transition-colors ${
          consent ? "cursor-pointer hover:border-ink" : "cursor-not-allowed opacity-50"
        } ${dragging ? "border-ink bg-white/60" : "border-line"}`}
      >
        <ImageUp size={22} aria-hidden />
        <span className="font-medium">{hero.photo ? "Replace photo" : "Drop in a finish-line photo"}</span>
        <span className="text-xs text-ink-soft">or tap to choose · it&apos;s dotted live, like a thermal print</span>
        <input
          id={inputId}
          type="file"
          accept="image/*"
          disabled={!consent}
          className="sr-only"
          onChange={(e) => {
            void loadFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </label>
      {error && (
        <p role="alert" className="text-xs text-spot">
          {error}
        </p>
      )}

      {hero.photo && (
        <div className="space-y-3">
          {hasSource ? (
            <>
            <Segmented
              label="Dot style"
              size="sm"
              value={hero.dither}
              options={(Object.keys(DITHER_LABELS) as DitherAlgo[]).map((value) => ({ value, label: DITHER_LABELS[value] }))}
              onChange={(dither) => dispatch({ type: "setHero", patch: { dither } })}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-xs">
                <span className="flex justify-between">
                  <span>Brightness</span>
                  <span className="font-mono">{brightness}</span>
                </span>
                <input type="range" min={-60} max={60} value={brightness} onChange={(e) => setBrightness(+e.target.value)} className="w-full accent-[var(--ink)]" />
              </label>
              <label className="space-y-1 text-xs">
                <span className="flex justify-between">
                  <span>Contrast</span>
                  <span className="font-mono">{contrast}</span>
                </span>
                <input type="range" min={-50} max={80} value={contrast} onChange={(e) => setContrast(+e.target.value)} className="w-full accent-[var(--ink)]" />
              </label>
            </div>
            </>
          ) : (
            <p className="text-xs text-ink-soft">To change the dots, choose the photo again: we didn&apos;t keep the original.</p>
          )}
          <button type="button" onClick={clear} className="flex min-h-9 items-center gap-1.5 text-sm text-ink-soft hover:text-spot">
            <Trash2 size={15} aria-hidden /> Remove photo
          </button>
        </div>
      )}
    </div>
  );
}
