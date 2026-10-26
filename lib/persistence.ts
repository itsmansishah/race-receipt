// Draft persistence. The draft goes to localStorage; the dithered photo goes to
// sessionStorage only (tab-scoped, cleared when the tab closes) so the print
// proof can show it. The source photo is never stored anywhere.

import { createInitialState, MAX_ITEMS, type DitheredPhoto, type ReceiptState } from "./receipt-state";

const DRAFT_KEY = "race-receipt:draft:v1";
const PHOTO_KEY = "race-receipt:photo:v1";

function safeGet(storage: () => Storage, key: string): string | null {
  try {
    return storage().getItem(key);
  } catch {
    return null;
  }
}

function safeSet(storage: () => Storage, key: string, value: string | null) {
  try {
    if (value === null) storage().removeItem(key);
    else storage().setItem(key, value);
  } catch {
    // Private mode or quota: the draft just won't survive a refresh.
  }
}

/** Merges a stored draft over fresh defaults so older or partial drafts still load. */
export function mergeDraft(raw: unknown): ReceiptState {
  const base = createInitialState();
  if (!raw || typeof raw !== "object") return base;
  const d = raw as Partial<ReceiptState>;
  const pick = <T,>(value: unknown, fallback: T): T => (typeof value === typeof fallback ? (value as T) : fallback);

  return {
    ...base,
    giftFor: pick(d.giftFor, base.giftFor),
    recipientName: pick(d.recipientName, base.recipientName),
    giftMessage: pick(d.giftMessage, base.giftMessage),
    runnerName: pick(d.runnerName, base.runnerName),
    raceTitle: pick(d.raceTitle, base.raceTitle),
    city: pick(d.city, base.city),
    raceDate: pick(d.raceDate, base.raceDate),
    bib: pick(d.bib, base.bib),
    finishTime: pick(d.finishTime, base.finishTime),
    units: d.units === "km" ? "km" : "mi",
    hero: { ...base.hero, ...(d.hero ?? {}), photo: null },
    timeBlock: {
      ...base.timeBlock,
      ...(d.timeBlock ?? {}),
      splits: { ...base.timeBlock.splits, ...(d.timeBlock?.splits ?? {}) },
    },
    items: Array.isArray(d.items)
      ? d.items
          .filter((i) => i && typeof i.id === "string" && typeof i.name === "string")
          .slice(0, MAX_ITEMS)
          .map((i) => ({ id: i.id, name: i.name, qty: Number(i.qty) || 0, detail: String(i.detail ?? "") }))
      : base.items,
    footerNote: pick(d.footerNote, base.footerNote),
    print: { ...base.print, ...(d.print ?? {}) },
  };
}

export function loadDraft(): ReceiptState | null {
  const json = safeGet(() => localStorage, DRAFT_KEY);
  if (!json) return null;
  try {
    const state = mergeDraft(JSON.parse(json));
    state.hero.photo = loadPhoto();
    return state;
  } catch {
    return null;
  }
}

export function saveDraft(state: ReceiptState) {
  const { photo, ...hero } = state.hero;
  void photo;
  safeSet(() => localStorage, DRAFT_KEY, JSON.stringify({ ...state, hero }));
}

export function clearDraft() {
  safeSet(() => localStorage, DRAFT_KEY, null);
  savePhoto(null);
}

export function loadPhoto(): DitheredPhoto | null {
  const json = safeGet(() => sessionStorage, PHOTO_KEY);
  if (!json) return null;
  try {
    return JSON.parse(json) as DitheredPhoto;
  } catch {
    return null;
  }
}

export function savePhoto(photo: DitheredPhoto | null) {
  safeSet(() => sessionStorage, PHOTO_KEY, photo ? JSON.stringify(photo) : null);
}
