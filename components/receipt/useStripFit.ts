"use client";

import { useCallback, useState } from "react";
import { availableStripHeight, fitStrip, PRINT_SIZES } from "@/lib/print-sizes";
import type { PrintSize } from "@/lib/receipt-state";

/** Tracks the strip's measured height and how it fits the chosen print size. */
export function useStripFit(size: PrintSize) {
  const [naturalHeight, setNaturalHeight] = useState(0);
  const onMeasure = useCallback((h: number) => setNaturalHeight(h), []);
  const fit = fitStrip(naturalHeight, availableStripHeight(size));

  /** The smallest print size that holds the strip at full size, if any. */
  const fullSizeFit = (Object.keys(PRINT_SIZES) as PrintSize[]).find(
    (s) => naturalHeight > 0 && naturalHeight <= availableStripHeight(s),
  );

  return { naturalHeight, onMeasure, fit, fullSizeFit };
}
