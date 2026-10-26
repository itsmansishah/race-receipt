import { MARATHON_KM, parseTime, type Units } from "./time";
import type { RouteSource } from "./route";
import type { DitherAlgo } from "./dither";

export type { Units };

export const MAX_ITEMS = 15;
export const MAX_QTY = 9999;

export const LIMITS = {
  runnerName: 28,
  raceTitle: 40,
  city: 28,
  bib: 8,
  recipientName: 40,
  giftMessage: 280,
  itemName: 28,
  itemDetail: 32,
  footerNote: 80,
  mantra: 100,
} as const;

export type GiftFor = "self" | "friend";
export type PrintSize = "8x10" | "11x14" | "12x18";
export type FrameOption = "none" | "frame" | "frame-mat";
export type FrameColor = "black" | "oak" | "white";
export type SpotInk = "none" | "red" | "blue";
export type HeroKind = "route" | "photo" | "none";
/** What sits in the time block: real times, a mantra, a quip, or nothing at all. */
export type TimeBlockMode = "times" | "mantra" | "quip" | "none";

export type SplitKey = "5k" | "10k" | "half" | "30k";

export const SPLITS: { key: SplitKey; label: string; km: number }[] = [
  { key: "5k", label: "5K", km: 5 },
  { key: "10k", label: "10K", km: 10 },
  { key: "half", label: "HALF", km: MARATHON_KM / 2 },
  { key: "30k", label: "30K", km: 30 },
];

export interface ReceiptItem {
  id: string;
  name: string;
  qty: number;
  detail: string;
}

/** A dithered photo held in memory only. The source photo is never stored. */
export interface DitheredPhoto {
  dataUrl: string;
  width: number;
  height: number;
}

export interface ReceiptState {
  giftFor: GiftFor;
  recipientName: string;
  giftMessage: string;

  runnerName: string;
  raceTitle: string;
  city: string;
  /** ISO yyyy-mm-dd */
  raceDate: string;
  bib: string;
  /** As typed. Blank = race-day receipt; a valid time = finished receipt. Doubles as the Finish split. */
  finishTime: string;
  units: Units;

  hero: {
    kind: HeroKind;
    route: RouteSource;
    dither: DitherAlgo;
    photo: DitheredPhoto | null;
  };

  timeBlock: {
    mode: TimeBlockMode;
    showSplits: boolean;
    splits: Record<SplitKey, string>;
    mantra: string;
    quip: string;
  };

  items: ReceiptItem[];
  footerNote: string;

  print: {
    size: PrintSize;
    frame: FrameOption;
    frameColor: FrameColor;
    spotInk: SpotInk;
  };
}

export const DEFAULT_ITEMS: Omit<ReceiptItem, "id">[] = [
  { name: "Energy Gel", qty: 6, detail: "" },
  { name: "Toenails Sacrificed", qty: 1, detail: "" },
  { name: "Port-a-Potty Stops", qty: 2, detail: "" },
  { name: "High Fives from Strangers", qty: 84, detail: "" },
  { name: "Mile 21 Wall Hit", qty: 1, detail: "" },
];

export const QUICK_ADD_ITEMS = [
  "Electrolyte Chews",
  "Existential Crises",
  "New PR",
  "Blisters",
  "Spotify Skips",
] as const;

export const MANTRA_SUGGESTIONS = ["Trust the training", "One more mile", "Pain is temporary, 26.2 is forever"];
export const QUIP_SUGGESTIONS = ["Ran 26.2 miles for a banana and a foil blanket", "Paid money to do this", "Legs: out of stock"];

let idCounter = 0;
export function newId(): string {
  idCounter += 1;
  return `item-${Date.now().toString(36)}-${idCounter}`;
}

export function createInitialState(): ReceiptState {
  return {
    giftFor: "friend",
    recipientName: "",
    giftMessage: "",
    runnerName: "Jordan Lee",
    raceTitle: "Chicago Marathon",
    city: "Chicago, IL",
    raceDate: "2026-10-11",
    bib: "40123",
    finishTime: "",
    units: "mi",
    hero: { kind: "route", route: { kind: "sample" }, dither: "atkinson", photo: null },
    timeBlock: {
      mode: "times",
      showSplits: false,
      splits: { "5k": "", "10k": "", half: "", "30k": "" },
      mantra: MANTRA_SUGGESTIONS[0],
      quip: QUIP_SUGGESTIONS[0],
    },
    items: DEFAULT_ITEMS.map((item, i) => ({ ...item, id: `default-${i}` })),
    footerNote: "Never again (see you next year)",
    print: { size: "11x14", frame: "frame-mat", frameColor: "black", spotInk: "red" },
  };
}

/** Top-level fields that are plain values and can be set directly. */
type ScalarKey = {
  [K in keyof ReceiptState]: ReceiptState[K] extends string ? K : never;
}[keyof ReceiptState];

export type ReceiptAction =
  | { [K in ScalarKey]: { type: "setField"; field: K; value: ReceiptState[K] } }[ScalarKey]
  | { type: "setHero"; patch: Partial<ReceiptState["hero"]> }
  | { type: "setTimeBlock"; patch: Partial<Omit<ReceiptState["timeBlock"], "splits">> }
  | { type: "setSplit"; key: SplitKey; value: string }
  | { type: "setPrint"; patch: Partial<ReceiptState["print"]> }
  | { type: "addItem"; item?: Partial<Omit<ReceiptItem, "id">>; id?: string }
  | { type: "updateItem"; id: string; patch: Partial<Omit<ReceiptItem, "id">> }
  | { type: "removeItem"; id: string }
  | { type: "moveItem"; id: string; toIndex: number }
  | { type: "replace"; state: ReceiptState }
  | { type: "reset" };

function clampQty(qty: number): number {
  if (!Number.isFinite(qty)) return 0;
  return Math.min(MAX_QTY, Math.max(0, Math.round(qty)));
}

export function receiptReducer(state: ReceiptState, action: ReceiptAction): ReceiptState {
  switch (action.type) {
    case "setField":
      return { ...state, [action.field]: action.value };
    case "setHero":
      return { ...state, hero: { ...state.hero, ...action.patch } };
    case "setTimeBlock":
      return { ...state, timeBlock: { ...state.timeBlock, ...action.patch } };
    case "setSplit":
      return {
        ...state,
        timeBlock: { ...state.timeBlock, splits: { ...state.timeBlock.splits, [action.key]: action.value } },
      };
    case "setPrint":
      return { ...state, print: { ...state.print, ...action.patch } };
    case "addItem": {
      if (state.items.length >= MAX_ITEMS) return state;
      const item: ReceiptItem = {
        id: action.id ?? newId(),
        name: (action.item?.name ?? "").slice(0, LIMITS.itemName),
        qty: clampQty(action.item?.qty ?? 1),
        detail: (action.item?.detail ?? "").slice(0, LIMITS.itemDetail),
      };
      return { ...state, items: [...state.items, item] };
    }
    case "updateItem": {
      const { patch } = action;
      return {
        ...state,
        items: state.items.map((item) =>
          item.id === action.id
            ? {
                ...item,
                ...(patch.name !== undefined && { name: patch.name.slice(0, LIMITS.itemName) }),
                ...(patch.qty !== undefined && { qty: clampQty(patch.qty) }),
                ...(patch.detail !== undefined && { detail: patch.detail.slice(0, LIMITS.itemDetail) }),
              }
            : item,
        ),
      };
    }
    case "removeItem":
      return { ...state, items: state.items.filter((item) => item.id !== action.id) };
    case "moveItem": {
      const from = state.items.findIndex((item) => item.id === action.id);
      if (from === -1) return state;
      const to = Math.max(0, Math.min(state.items.length - 1, action.toIndex));
      if (from === to) return state;
      const items = [...state.items];
      const [moved] = items.splice(from, 1);
      items.splice(to, 0, moved);
      return { ...state, items };
    }
    case "replace":
      return action.state;
    case "reset":
      return createInitialState();
  }
}

// ---- Derived values -------------------------------------------------------

export function finishSeconds(state: ReceiptState): number | null {
  return parseTime(state.finishTime);
}

/** Times are shown only in "times" mode; a valid finish time makes it a finished receipt. */
export function receiptKind(state: ReceiptState): "finished" | "race-day" {
  return state.timeBlock.mode === "times" && finishSeconds(state) !== null ? "finished" : "race-day";
}

export interface SplitIssue {
  key: SplitKey | "finish";
  message: string;
}

/** Cumulative splits must be valid and strictly increasing, ending at or before the finish. */
export function validateSplits(state: ReceiptState): SplitIssue[] {
  const issues: SplitIssue[] = [];
  let previous = 0;
  let previousLabel = "the start";
  const rows: { key: SplitKey | "finish"; label: string; value: string }[] = [
    ...SPLITS.map((s) => ({ key: s.key, label: s.label, value: state.timeBlock.splits[s.key] })),
    { key: "finish", label: "Finish", value: state.finishTime },
  ];
  for (const row of rows) {
    if (!row.value.trim()) continue;
    const secs = parseTime(row.value);
    if (secs === null) {
      issues.push({ key: row.key, message: `${row.label}: use HH:MM:SS` });
      continue;
    }
    if (secs <= previous) {
      issues.push({ key: row.key, message: `${row.label} must be later than ${previousLabel}` });
      continue;
    }
    previous = secs;
    previousLabel = row.label;
  }
  return issues;
}
