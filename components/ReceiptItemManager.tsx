"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, GripVertical, Plus, Trash2 } from "lucide-react";
import { useReceipt, useReceiptDispatch } from "./ReceiptProvider";
import { Chip } from "./ui";
import { LIMITS, MAX_ITEMS, MAX_QTY, newId, QUICK_ADD_ITEMS, type ReceiptItem } from "@/lib/receipt-state";

const cellInput =
  "w-full rounded-md border border-line bg-white/70 px-2.5 py-2 text-base text-ink placeholder:text-ink-soft/70 focus:border-ink focus:outline-none sm:text-sm";

/** Quantity keeps its own draft string so clearing the field doesn't flash a 0 on the receipt. */
function QtyInput({ item, onCommit }: { item: ReceiptItem; onCommit: (qty: number) => void }) {
  // null = not editing, show the stored quantity.
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      aria-label={`Quantity for ${item.name || "item"}`}
      className={`${cellInput} text-right font-mono tabular-nums`}
      inputMode="numeric"
      value={draft ?? String(item.qty)}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, "").slice(0, String(MAX_QTY).length);
        setDraft(digits);
        if (digits) onCommit(Number(digits));
      }}
      onBlur={() => {
        if (draft === "") onCommit(0);
        setDraft(null);
      }}
    />
  );
}

function ItemRow({
  item,
  index,
  count,
  nameRef,
  onRemove,
}: {
  item: ReceiptItem;
  index: number;
  count: number;
  nameRef?: (el: HTMLInputElement | null) => void;
  onRemove: (item: ReceiptItem) => void;
}) {
  const dispatch = useReceiptDispatch();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  const label = item.name || `item ${index + 1}`;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`grid grid-cols-[auto_1fr_auto] items-start gap-2 rounded-lg border bg-panel p-2 sm:grid-cols-[auto_1fr_4.5rem_auto] ${
        isDragging ? "relative z-10 border-ink shadow-lg" : "border-line"
      }`}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        aria-label={`Drag to reorder ${label}`}
        className="flex h-10 w-8 cursor-grab touch-none items-center justify-center rounded text-ink-soft hover:text-ink active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={18} aria-hidden />
      </button>

      <div className="min-w-0 space-y-1.5">
        <input
          ref={nameRef}
          aria-label={`Item ${index + 1} name`}
          className={cellInput}
          placeholder="Item name"
          maxLength={LIMITS.itemName}
          value={item.name}
          onChange={(e) => dispatch({ type: "updateItem", id: item.id, patch: { name: e.target.value } })}
        />
        <input
          aria-label={`Detail for ${label} (optional)`}
          className={`${cellInput} text-sm`}
          placeholder="Detail or stat (optional), e.g. @ mile 8, 13, 18"
          maxLength={LIMITS.itemDetail}
          value={item.detail}
          onChange={(e) => dispatch({ type: "updateItem", id: item.id, patch: { detail: e.target.value } })}
        />
        <div className="flex items-center gap-2 sm:hidden">
          <span className="text-xs text-ink-soft">Qty</span>
          <div className="w-20">
            <QtyInput item={item} onCommit={(qty) => dispatch({ type: "updateItem", id: item.id, patch: { qty } })} />
          </div>
        </div>
      </div>

      <div className="hidden sm:block">
        <QtyInput item={item} onCommit={(qty) => dispatch({ type: "updateItem", id: item.id, patch: { qty } })} />
      </div>

      <div className="flex flex-col items-center">
        <button
          type="button"
          aria-label={`Remove ${label}`}
          onClick={() => onRemove(item)}
          className="flex h-10 w-10 items-center justify-center rounded text-ink-soft hover:bg-spot/10 hover:text-spot"
        >
          <Trash2 size={17} aria-hidden />
        </button>
        <div className="flex">
          <button
            type="button"
            aria-label={`Move ${label} up`}
            disabled={index === 0}
            onClick={() => dispatch({ type: "moveItem", id: item.id, toIndex: index - 1 })}
            className="flex h-8 w-6 items-center justify-center rounded text-ink-soft hover:text-ink disabled:opacity-25"
          >
            <ArrowUp size={15} aria-hidden />
          </button>
          <button
            type="button"
            aria-label={`Move ${label} down`}
            disabled={index === count - 1}
            onClick={() => dispatch({ type: "moveItem", id: item.id, toIndex: index + 1 })}
            className="flex h-8 w-6 items-center justify-center rounded text-ink-soft hover:text-ink disabled:opacity-25"
          >
            <ArrowDown size={15} aria-hidden />
          </button>
        </div>
      </div>
    </li>
  );
}

export function ReceiptItemManager() {
  const { items } = useReceipt();
  const dispatch = useReceiptDispatch();
  const [announcement, setAnnouncement] = useState("");
  const nameRefs = useRef(new Map<string, HTMLInputElement>());
  const focusNext = useRef<string | null>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const atCap = items.length >= MAX_ITEMS;
  const dndId = useId(); // stable id keeps dnd-kit's aria ids identical on server and client

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    if (focusNext.current) {
      nameRefs.current.get(focusNext.current)?.focus();
      focusNext.current = null;
    }
  }, [items]);

  const add = (name = "", focus = true) => {
    if (atCap) return;
    const id = newId();
    if (focus) focusNext.current = id;
    dispatch({ type: "addItem", id, item: { name, qty: 1 } });
    setAnnouncement(`Added ${name || "a new item"}. ${items.length + 1} of ${MAX_ITEMS} items.`);
  };

  const remove = (item: ReceiptItem) => {
    dispatch({ type: "removeItem", id: item.id });
    setAnnouncement(`Removed ${item.name || "item"}.`);
    addButtonRef.current?.focus();
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const toIndex = items.findIndex((i) => i.id === over.id);
    dispatch({ type: "moveItem", id: String(active.id), toIndex });
  };

  const existing = new Set(items.map((i) => i.name.toLowerCase()));

  return (
    <div className="space-y-3">
      <div className="hidden grid-cols-[auto_1fr_4.5rem_auto] gap-2 px-2 text-xs text-ink-soft sm:grid">
        <span className="w-8" />
        <span>Item and optional detail</span>
        <span className="text-right">Qty</span>
        <span className="w-10" />
      </div>

      <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <ul className="space-y-2" aria-label="Receipt items">
            {items.map((item, index) => (
              <ItemRow
                key={item.id}
                item={item}
                index={index}
                count={items.length}
                onRemove={remove}
                nameRef={(el) => {
                  if (el) nameRefs.current.set(item.id, el);
                  else nameRefs.current.delete(item.id);
                }}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          ref={addButtonRef}
          type="button"
          onClick={() => add()}
          disabled={atCap}
          className="flex min-h-11 items-center gap-1.5 rounded-full border border-ink px-4 text-sm font-medium hover:bg-ink hover:text-paper disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-ink"
        >
          <Plus size={16} aria-hidden /> Add item
        </button>
        <span className={`font-mono text-xs ${atCap ? "text-spot" : "text-ink-soft"}`}>
          {items.length}/{MAX_ITEMS} items{atCap && " · that's the max"}
        </span>
      </div>

      <div>
        <p className="mb-2 text-xs text-ink-soft">Quick add</p>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_ADD_ITEMS.map((name) => (
            <Chip key={name} disabled={atCap || existing.has(name.toLowerCase())} onClick={() => add(name, false)}>
              + {name}
            </Chip>
          ))}
        </div>
      </div>

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
