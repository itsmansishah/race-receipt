import { describe, expect, it } from "vitest";
import {
  createInitialState,
  MAX_ITEMS,
  MAX_QTY,
  receiptKind,
  receiptReducer,
  validateSplits,
  type ReceiptAction,
  type ReceiptState,
} from "@/lib/receipt-state";
import { mergeDraft } from "@/lib/persistence";
import { fitStrip, CANVAS } from "@/lib/print-sizes";

const run = (state: ReceiptState, ...actions: ReceiptAction[]) => actions.reduce(receiptReducer, state);

describe("initial state", () => {
  it("pre-fills the five default items and opens as a race-day gift", () => {
    const s = createInitialState();
    expect(s.items.map((i) => `${i.name} x${i.qty}`)).toEqual([
      "Energy Gel x6",
      "Toenails Sacrificed x1",
      "Port-a-Potty Stops x2",
      "High Fives from Strangers x84",
      "Mile 21 Wall Hit x1",
    ]);
    expect(s.giftFor).toBe("friend");
    expect(receiptKind(s)).toBe("race-day");
  });
});

describe("receiptReducer", () => {
  it("sets fields without mutating the previous state", () => {
    const before = createInitialState();
    const after = run(before, { type: "setField", field: "runnerName", value: "Sam" });
    expect(after.runnerName).toBe("Sam");
    expect(before.runnerName).toBe("Jordan Lee");
  });

  it("adds items up to the cap and ignores the rest", () => {
    let s = createInitialState();
    for (let i = 0; i < 20; i++) s = run(s, { type: "addItem", item: { name: `Thing ${i}` } });
    expect(s.items).toHaveLength(MAX_ITEMS);
  });

  it("clamps quantity and trims long names", () => {
    const s = run(
      createInitialState(),
      { type: "updateItem", id: "default-0", patch: { qty: 123456 } },
      { type: "updateItem", id: "default-1", patch: { qty: -4, name: "x".repeat(100) } },
    );
    expect(s.items[0].qty).toBe(MAX_QTY);
    expect(s.items[1].qty).toBe(0);
    expect(s.items[1].name.length).toBeLessThanOrEqual(28);
  });

  it("reorders and removes items", () => {
    let s = run(createInitialState(), { type: "moveItem", id: "default-4", toIndex: 0 });
    expect(s.items.map((i) => i.id)).toEqual(["default-4", "default-0", "default-1", "default-2", "default-3"]);
    s = run(s, { type: "moveItem", id: "default-4", toIndex: 99 });
    expect(s.items[s.items.length - 1].id).toBe("default-4");
    s = run(s, { type: "removeItem", id: "default-2" });
    expect(s.items.find((i) => i.id === "default-2")).toBeUndefined();
    expect(s.items).toHaveLength(4);
  });

  it("merges nested patches", () => {
    const s = run(
      createInitialState(),
      { type: "setPrint", patch: { size: "12x18" } },
      { type: "setSplit", key: "half", value: "1:50:00" },
      { type: "setTimeBlock", patch: { mode: "mantra" } },
    );
    expect(s.print).toMatchObject({ size: "12x18", frame: "frame-mat" });
    expect(s.timeBlock.splits).toMatchObject({ half: "1:50:00", "5k": "" });
    expect(s.timeBlock.mode).toBe("mantra");
  });
});

describe("receipt kind", () => {
  it("is finished only with a valid time in times mode", () => {
    const finished = run(createInitialState(), { type: "setField", field: "finishTime", value: "3:42:18" });
    expect(receiptKind(finished)).toBe("finished");
    expect(receiptKind(run(finished, { type: "setTimeBlock", patch: { mode: "quip" } }))).toBe("race-day");
    expect(receiptKind(run(finished, { type: "setField", field: "finishTime", value: "3:42" }))).toBe("race-day");
  });
});

describe("validateSplits", () => {
  it("accepts increasing cumulative splits", () => {
    const s = run(
      createInitialState(),
      { type: "setSplit", key: "5k", value: "0:25:00" },
      { type: "setSplit", key: "half", value: "1:50:00" },
      { type: "setField", field: "finishTime", value: "3:45:00" },
    );
    expect(validateSplits(s)).toEqual([]);
  });

  it("flags splits that go backwards or don't parse", () => {
    const s = run(
      createInitialState(),
      { type: "setSplit", key: "5k", value: "0:30:00" },
      { type: "setSplit", key: "10k", value: "0:29:00" },
      { type: "setSplit", key: "30k", value: "nope" },
    );
    expect(validateSplits(s).map((i) => i.key)).toEqual(["10k", "30k"]);
  });
});

describe("mergeDraft", () => {
  it("restores a saved draft but never a photo", () => {
    const saved = { ...createInitialState(), runnerName: "Ana", hero: { kind: "photo", photo: { dataUrl: "x" } } };
    const s = mergeDraft(JSON.parse(JSON.stringify(saved)));
    expect(s.runnerName).toBe("Ana");
    expect(s.hero.kind).toBe("photo");
    expect(s.hero.photo).toBeNull();
  });

  it("falls back to defaults for junk", () => {
    expect(mergeDraft("nonsense")).toEqual(createInitialState());
    expect(mergeDraft({ units: "furlongs", items: "x" }).units).toBe("mi");
  });
});

describe("fitStrip", () => {
  it("keeps full size when it fits, scales when long, blocks when too long", () => {
    expect(fitStrip(900, 1000)).toEqual({ scale: 1, status: "fits" });
    expect(fitStrip(1100, 1000).status).toBe("scaled");
    expect(fitStrip(1000 / (CANVAS.minScale - 0.01), 1000).status).toBe("too-long");
  });
});
