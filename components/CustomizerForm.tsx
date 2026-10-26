"use client";

import { Ban, Gift, ImageIcon, Map as MapIcon, User } from "lucide-react";
import { useReceipt, useReceiptDispatch } from "./ReceiptProvider";
import { ReceiptItemManager } from "./ReceiptItemManager";
import { PhotoDropzone } from "./PhotoDropzone";
import { PrintOptions } from "./PrintOptions";
import { Chip, Section, Segmented, Switch, TextArea, TextField, TimeField } from "./ui";
import {
  LIMITS,
  MANTRA_SUGGESTIONS,
  QUIP_SUGGESTIONS,
  SPLITS,
  validateSplits,
  type TimeBlockMode,
} from "@/lib/receipt-state";
import { parseTime } from "@/lib/time";

const FOOTER_SUGGESTIONS = ["Never again (see you next year)", "Worth every blister", "Earned the beer"];

export function CustomizerForm() {
  const state = useReceipt();
  const dispatch = useReceiptDispatch();
  const issues = validateSplits(state);
  const issueFor = (key: string) => issues.find((i) => i.key === key)?.message;
  const isGift = state.giftFor === "friend";
  const finishTyped = state.finishTime.trim() !== "";
  const finishValid = parseTime(state.finishTime) !== null;

  const finishField = (
    <TimeField
      label="Official finish time (optional)"
      hint={
        finishValid
          ? "Finished receipt: the time becomes the big number."
          : "Leave blank if the race hasn't happened yet. You'll get a race-day receipt."
      }
      value={state.finishTime}
      error={finishTyped ? issueFor("finish") : undefined}
      onChange={(value) => dispatch({ type: "setField", field: "finishTime", value })}
    />
  );

  return (
    <form className="space-y-3" onSubmit={(e) => e.preventDefault()} aria-label="Customize your Race Receipt">
      <Section step="01" title="Who is it for?">
        <Segmented
          label="Who is it for?"
          value={state.giftFor}
          options={[
            { value: "friend", label: "A gift for someone", icon: <Gift size={16} aria-hidden /> },
            { value: "self", label: "For myself", icon: <User size={16} aria-hidden /> },
          ]}
          onChange={(value) => dispatch({ type: "setField", field: "giftFor", value })}
        />
        {isGift && (
          <>
            <TextField
              label="Recipient name"
              autoComplete="name"
              maxLength={LIMITS.recipientName}
              value={state.recipientName}
              onChange={(value) => dispatch({ type: "setField", field: "recipientName", value })}
            />
            <TextArea
              label="Gift message (optional)"
              hint="Printed on a card in the box, not on the receipt."
              maxLength={LIMITS.giftMessage}
              value={state.giftMessage}
              onChange={(value) => dispatch({ type: "setField", field: "giftMessage", value })}
            />
          </>
        )}
      </Section>

      <Section step="02" title="Race and runner" description="Don't know everything yet? Fill in what you have.">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Runner name"
            maxLength={LIMITS.runnerName}
            value={state.runnerName}
            onChange={(value) => dispatch({ type: "setField", field: "runnerName", value })}
          />
          <TextField
            label="Race"
            maxLength={LIMITS.raceTitle}
            value={state.raceTitle}
            onChange={(value) => dispatch({ type: "setField", field: "raceTitle", value })}
          />
          <TextField
            label="City"
            maxLength={LIMITS.city}
            value={state.city}
            onChange={(value) => dispatch({ type: "setField", field: "city", value })}
          />
          <TextField
            label="Race date"
            type="date"
            value={state.raceDate}
            onChange={(value) => dispatch({ type: "setField", field: "raceDate", value })}
          />
          <TextField
            label="Bib number"
            inputMode="numeric"
            maxLength={LIMITS.bib}
            hint="Also used in the barcode."
            value={state.bib}
            onChange={(value) => dispatch({ type: "setField", field: "bib", value: value.toUpperCase() })}
          />
          {state.timeBlock.mode === "times" && finishField}
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-medium">Units</p>
          <Segmented
            label="Units"
            size="sm"
            value={state.units}
            options={[
              { value: "mi", label: "Miles" },
              { value: "km", label: "Kilometres" },
            ]}
            onChange={(value) => dispatch({ type: "setField", field: "units", value })}
          />
        </div>
      </Section>

      <Section step="03" title="Hero image" description="The big picture at the top of the receipt.">
        <Segmented
          label="Hero image"
          value={state.hero.kind}
          options={[
            { value: "route", label: "Course map", icon: <MapIcon size={16} aria-hidden /> },
            { value: "photo", label: "Finish-line photo", icon: <ImageIcon size={16} aria-hidden /> },
            { value: "none", label: "None", icon: <Ban size={16} aria-hidden /> },
          ]}
          onChange={(kind) => dispatch({ type: "setHero", patch: { kind } })}
        />
        {state.hero.kind === "route" && (
          <div className="rounded-lg border border-dashed border-line p-3 text-sm text-ink-soft">
            Showing a sample course. Picking your race from our course library, drawing a route or uploading a GPX
            file is coming soon.
          </div>
        )}
        {state.hero.kind === "photo" && <PhotoDropzone />}
      </Section>

      <Section
        step="04"
        title="Times, a mantra, or neither"
        description="Not about the clock? Swap times for a mantra or a quip, or leave the block off."
      >
        <Segmented<TimeBlockMode>
          label="Time block"
          value={state.timeBlock.mode}
          options={[
            { value: "times", label: "Times" },
            { value: "mantra", label: "Mantra" },
            { value: "quip", label: "Quip" },
            { value: "none", label: "Leave it off" },
          ]}
          onChange={(mode) => dispatch({ type: "setTimeBlock", patch: { mode } })}
        />

        {state.timeBlock.mode === "times" && (
          <>
            <Switch
              label="Show splits"
              description={finishValid ? "Cumulative times at each checkpoint." : "Before race day these print as goal splits."}
              checked={state.timeBlock.showSplits}
              onChange={(showSplits) => dispatch({ type: "setTimeBlock", patch: { showSplits } })}
            />
            {state.timeBlock.showSplits && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {SPLITS.map((split) => (
                  <TimeField
                    key={split.key}
                    label={split.label === "HALF" ? "Half" : split.label}
                    value={state.timeBlock.splits[split.key]}
                    error={issueFor(split.key)}
                    onChange={(value) => dispatch({ type: "setSplit", key: split.key, value })}
                  />
                ))}
                <TimeField
                  label="Finish"
                  value={state.finishTime}
                  error={issueFor("finish")}
                  onChange={(value) => dispatch({ type: "setField", field: "finishTime", value })}
                />
              </div>
            )}
          </>
        )}

        {(state.timeBlock.mode === "mantra" || state.timeBlock.mode === "quip") && (
          <>
            <TextField
              label={state.timeBlock.mode === "mantra" ? "Mantra" : "Quip"}
              maxLength={LIMITS.mantra}
              showCount
              value={state.timeBlock.mode === "mantra" ? state.timeBlock.mantra : state.timeBlock.quip}
              onChange={(value) =>
                dispatch({
                  type: "setTimeBlock",
                  patch: state.timeBlock.mode === "mantra" ? { mantra: value } : { quip: value },
                })
              }
            />
            <div className="flex flex-wrap gap-1.5">
              {(state.timeBlock.mode === "mantra" ? MANTRA_SUGGESTIONS : QUIP_SUGGESTIONS).map((text) => (
                <Chip
                  key={text}
                  onClick={() =>
                    dispatch({
                      type: "setTimeBlock",
                      patch: state.timeBlock.mode === "mantra" ? { mantra: text } : { quip: text },
                    })
                  }
                >
                  {text}
                </Chip>
              ))}
            </div>
          </>
        )}
      </Section>

      <Section step="05" title="Receipt items" description="What the race cost them, itemised. Drag or use the arrows to reorder.">
        <ReceiptItemManager />
      </Section>

      <Section step="06" title="Footer note">
        <TextField
          label="Footer note"
          maxLength={LIMITS.footerNote}
          showCount
          value={state.footerNote}
          onChange={(value) => dispatch({ type: "setField", field: "footerNote", value })}
        />
        <div className="flex flex-wrap gap-1.5">
          {FOOTER_SUGGESTIONS.map((text) => (
            <Chip key={text} onClick={() => dispatch({ type: "setField", field: "footerNote", value: text })}>
              {text}
            </Chip>
          ))}
        </div>
      </Section>

      <Section step="07" title="Print and frame">
        <PrintOptions />
      </Section>
    </form>
  );
}
