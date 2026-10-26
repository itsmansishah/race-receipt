import { useId } from "react";

/** useId, made safe for SVG url(#id) references. */
export function useSvgId(prefix: string): string {
  return `${prefix}-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
}
