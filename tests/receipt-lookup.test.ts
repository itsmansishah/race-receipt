import { describe, expect, it } from "vitest";
import {
  getReceipt,
  isReceiptId,
  newReceiptId,
  receiptIdsFromOrder,
  RECEIPT_ATTRIBUTE,
  updatePendingReceipt,
} from "@/lib/server/receipts";
import { createInitialState } from "@/lib/receipt-state";
import { freshDb, paidOrder, saveReceipt } from "./helpers";

describe("receipt IDs", () => {
  it("are unguessable and URL-safe", () => {
    const ids = new Set(Array.from({ length: 200 }, newReceiptId));
    expect(ids.size).toBe(200);
    for (const id of ids) expect(isReceiptId(id)).toBe(true);
  });

  it("reject anything else", () => {
    for (const bad of ["", "rr_", "rr_short", "abc_AAAAAAAAAAAAAAAAAAAAAA", "rr_AAAAAAAAAAAAAAAAAAAAA/", 42, null]) {
      expect(isReceiptId(bad)).toBe(false);
    }
  });
});

describe("getReceipt", () => {
  it("finds a saved receipt by ID with its full design", () => {
    const db = freshDb();
    const id = saveReceipt(db, { runnerName: "Ana Ruiz", raceTitle: "Berlin Marathon" });
    const receipt = getReceipt(db, id)!;
    expect(receipt.id).toBe(id);
    expect(receipt.status).toBe("pending_payment");
    expect(receipt.design.runnerName).toBe("Ana Ruiz");
    expect(receipt.design.items).toHaveLength(5);
    expect(receipt.finish).toBe("Black frame + mat");
  });

  it("returns null for unknown or malformed IDs", () => {
    const db = freshDb();
    saveReceipt(db);
    expect(getReceipt(db, newReceiptId())).toBeNull();
    expect(getReceipt(db, "'; DROP TABLE receipts; --")).toBeNull();
  });

  it("never stores image data in the design", () => {
    const db = freshDb();
    const design = createInitialState();
    design.hero = { ...design.hero, kind: "photo", photo: { dataUrl: "data:image/png;base64,AAAA", width: 1, height: 1 } };
    const id = saveReceipt(db, design);
    expect(getReceipt(db, id)!.design.hero.photo).toBeNull();
  });

  it("lets an unpaid receipt be updated, but not a paid one", () => {
    const db = freshDb();
    const id = saveReceipt(db);
    const input = { design: { ...createInitialState(), runnerName: "Changed" }, photoKey: null, size: "8x10", finish: "Unframed" };
    expect(updatePendingReceipt(db, id, input)).toBe(true);
    expect(getReceipt(db, id)!.design.runnerName).toBe("Changed");
    db.prepare("UPDATE receipts SET status='paid' WHERE id=?").run(id);
    expect(updatePendingReceipt(db, id, input)).toBe(false);
  });
});

describe("receiptIdsFromOrder", () => {
  const id = newReceiptId();

  it("reads the ID from the line item properties", () => {
    expect(receiptIdsFromOrder(paidOrder(id))).toEqual([id]);
  });

  it("falls back to a cart-level attribute", () => {
    expect(receiptIdsFromOrder({ id: 1, line_items: [{ properties: null }], note_attributes: [{ name: RECEIPT_ATTRIBUTE, value: id }] })).toEqual([id]);
  });

  it("ignores missing, foreign and malformed values", () => {
    expect(receiptIdsFromOrder({ id: 1 })).toEqual([]);
    expect(receiptIdsFromOrder({ id: 1, line_items: [{ properties: [{ name: "Engraving", value: id }] }] })).toEqual([]);
    expect(receiptIdsFromOrder({ id: 1, line_items: [{ properties: [{ name: RECEIPT_ATTRIBUTE, value: "nope" }] }] })).toEqual([]);
  });

  it("returns each receipt once, even across lines", () => {
    const other = newReceiptId();
    const order = {
      id: 1,
      line_items: [
        { properties: [{ name: RECEIPT_ATTRIBUTE, value: id }] },
        { properties: [{ name: RECEIPT_ATTRIBUTE, value: other }] },
      ],
      note_attributes: [{ name: RECEIPT_ATTRIBUTE, value: id }],
    };
    expect(receiptIdsFromOrder(order)).toEqual([id, other]);
  });
});
