"use client";

import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { normalizeTimeInput } from "@/lib/time";

export function Section({
  step,
  title,
  description,
  defaultOpen = true,
  children,
}: {
  step: string;
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details open={defaultOpen} className="group rounded-xl border border-line bg-panel">
      <summary className="flex cursor-pointer list-none items-start gap-3 p-4 sm:p-5 [&::-webkit-details-marker]:hidden">
        <span className="font-mono text-xs text-spot">{step}</span>
        <span className="flex-1">
          <span className="block text-base font-medium">{title}</span>
          {description && <span className="mt-0.5 block text-sm text-ink-soft">{description}</span>}
        </span>
        <span aria-hidden className="font-mono text-ink-soft transition-transform group-open:rotate-45">
          +
        </span>
      </summary>
      <div className="space-y-4 px-4 pb-5 sm:px-5">{children}</div>
    </details>
  );
}

const inputClass =
  "w-full rounded-lg border border-line bg-white/70 px-3 py-2.5 text-base text-ink placeholder:text-ink-soft/70 focus:border-ink focus:outline-none sm:text-sm";

export function Field({
  label,
  hint,
  error,
  counter,
  children,
}: {
  label: string;
  hint?: ReactNode;
  error?: string;
  counter?: string;
  children: (props: { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean }) => ReactNode;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const describedBy = hint || error ? hintId : undefined;
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        {counter && <span className="font-mono text-[11px] text-ink-soft">{counter}</span>}
      </div>
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}
      {(hint || error) && (
        <p id={hintId} className={`text-xs ${error ? "text-spot" : "text-ink-soft"}`}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

export function TextField({
  label,
  hint,
  value,
  onChange,
  maxLength,
  showCount,
  ...rest
}: {
  label: string;
  hint?: ReactNode;
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  showCount?: boolean;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "id">) {
  return (
    <Field label={label} hint={hint} counter={showCount && maxLength ? `${value.length}/${maxLength}` : undefined}>
      {(a11y) => (
        <input
          {...a11y}
          {...rest}
          className={inputClass}
          value={value}
          maxLength={maxLength}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </Field>
  );
}

export function TextArea({
  label,
  hint,
  value,
  onChange,
  maxLength,
  rows = 3,
}: {
  label: string;
  hint?: ReactNode;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  rows?: number;
}) {
  return (
    <Field label={label} hint={hint} counter={`${value.length}/${maxLength}`}>
      {(a11y) => (
        <textarea
          {...a11y}
          rows={rows}
          className={`${inputClass} resize-y`}
          value={value}
          maxLength={maxLength}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </Field>
  );
}

/**
 * HH:MM:SS input. Updates the receipt on every keystroke (invalid partial
 * input simply doesn't show), and tidies the value on blur ("34218" → "03:42:18").
 */
export function TimeField({
  label,
  hint,
  value,
  onChange,
  error,
}: {
  label: string;
  hint?: ReactNode;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  const [blurError, setBlurError] = useState<string>();
  return (
    <Field label={label} hint={hint} error={blurError ?? error}>
      {(a11y) => (
        <input
          {...a11y}
          className={`${inputClass} font-mono tabular-nums`}
          inputMode="numeric"
          placeholder="HH:MM:SS"
          autoComplete="off"
          maxLength={8}
          value={value}
          onChange={(e) => {
            setBlurError(undefined);
            onChange(e.target.value.replace(/[^\d:]/g, ""));
          }}
          onBlur={() => {
            const normalized = normalizeTimeInput(value);
            if (normalized === null) setBlurError("Use HH:MM:SS, for example 03:42:18");
            else if (normalized !== value) onChange(normalized);
          }}
        />
      )}
    </Field>
  );
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  size = "md",
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string; icon?: ReactNode }[];
  onChange: (value: T) => void;
  size?: "sm" | "md";
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={`flex items-center gap-1.5 rounded-full border px-3.5 font-medium transition-colors ${
              size === "sm" ? "min-h-9 text-xs" : "min-h-11 text-sm"
            } ${active ? "border-ink bg-ink text-paper" : "border-line bg-white/60 text-ink hover:border-ink"}`}
          >
            {opt.icon}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function Switch({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <label htmlFor={id} className="flex-1 cursor-pointer">
        <span className="block text-sm font-medium">{label}</span>
        {description && <span className="block text-xs text-ink-soft">{description}</span>}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? "bg-ink" : "bg-line"}`}
      >
        <span
          aria-hidden
          className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-paper transition-transform ${checked ? "translate-x-5" : ""}`}
        />
      </button>
    </div>
  );
}

export function Chip({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="min-h-9 rounded-full border border-dashed border-ink/50 px-3 text-xs font-medium transition-colors hover:border-ink hover:bg-white/60 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}
