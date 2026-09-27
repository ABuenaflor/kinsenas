import { useId, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Sticker } from "@/components/ui/diy";
import { Field, MoneyInput, SegmentedControl, Select, TextInput } from "@/components/ui/inputs";
import { KeyboardHint } from "@/components/ui/misc";
import type { Centavos, Expense, Paydays } from "@/domain/types";
import { cn } from "@/lib/cn";
import { cutoffLabel, nextCutoffId, periodOf, prevCutoffId, todayISO } from "@/lib/periods";
import { useActiveBuckets, useActiveCategories } from "@/store/selectors";
import { useStore } from "@/store/useStore";

export interface ExpenseFormValue {
  amount: Centavos | null;
  categoryId: string;
  bucketId: string;
  date: string;
  note: string;
  cutoffOverride: string | null; // null = auto from date
}

export function useRecentCategories() {
  const categories = useActiveCategories();
  const expenses = useStore((s) => s.expenses);
  return useMemo(() => {
    const lastUsed = new Map<string, string>();
    for (const e of expenses) {
      const prev = lastUsed.get(e.categoryId);
      if (!prev || e.createdAt > prev) lastUsed.set(e.categoryId, e.createdAt);
    }
    return [...categories].sort((a, b) => (lastUsed.get(b.id) ?? "").localeCompare(lastUsed.get(a.id) ?? ""));
  }, [categories, expenses]);
}

export function initialForm(
  paydays: Paydays,
  editing?: Expense,
  prefill?: Partial<Expense>,
  fallbackCategory?: { id: string; defaultBucketId?: string },
): ExpenseFormValue {
  const base = editing ?? prefill;
  // Only keep an explicit override when it differs from what the date implies.
  const overridden = editing && editing.cutoffId !== periodOf(editing.date, paydays);
  return {
    amount: base?.amount ?? null,
    categoryId: base?.categoryId ?? fallbackCategory?.id ?? "",
    bucketId: base?.bucketId ?? fallbackCategory?.defaultBucketId ?? "essentials",
    date: base?.date ?? todayISO(),
    note: base?.note ?? "",
    cutoffOverride: overridden ? editing.cutoffId : null,
  };
}

/** Amount, category stickers, bucket, date, note. Enter submits. */
export function ExpenseForm({
  value,
  onChange,
  onSubmit,
  submitLabel,
  compact,
  autoFocus = true,
  extraActions,
}: {
  value: ExpenseFormValue;
  onChange: (v: ExpenseFormValue) => void;
  onSubmit: () => void;
  submitLabel: string;
  compact?: boolean;
  autoFocus?: boolean;
  extraActions?: React.ReactNode;
}) {
  const id = useId();
  const paydays = useStore((s) => s.settings.paydays);
  const categories = useRecentCategories();
  const buckets = useActiveBuckets();
  const amountRef = useRef<HTMLInputElement>(null);
  const [showAllCats, setShowAllCats] = useState(false);
  const autoCutoff = periodOf(value.date || todayISO(), paydays);
  const set = (patch: Partial<ExpenseFormValue>) => onChange({ ...value, ...patch });
  const visibleCats = showAllCats || !compact ? categories : categories.slice(0, 8);
  const canSave = value.amount !== null && value.amount > 0 && !!value.categoryId && !!value.bucketId && !!value.date;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSave) return;
        onSubmit();
        amountRef.current?.focus();
      }}
      className="space-y-4"
    >
      <div className={cn("grid gap-3", compact ? "md:grid-cols-[14rem_1fr]" : "")}>
        <Field label="Amount" htmlFor={`${id}-amt`}>
          <MoneyInput id={`${id}-amt`} ref={amountRef} size="lg" autoFocus={autoFocus} data-autofocus value={value.amount} onValueChange={(v) => set({ amount: v })} />
        </Field>
        <Field label="Note" htmlFor={`${id}-note`}>
          <TextInput id={`${id}-note`} className="min-h-14" value={value.note} onChange={(e) => set({ note: e.target.value })} placeholder="e.g. lunch with team" />
        </Field>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Category</legend>
        <div className="flex flex-wrap gap-2.5 p-1">
          {visibleCats.map((c) => (
            <Sticker
              key={c.id}
              id={c.id}
              selected={value.categoryId === c.id}
              aria-pressed={value.categoryId === c.id}
              onClick={() => set({ categoryId: c.id, bucketId: c.defaultBucketId && buckets.some((b) => b.id === c.defaultBucketId) ? c.defaultBucketId : value.bucketId })}
            >
              <span aria-hidden>{c.emoji}</span>
              {c.name}
            </Sticker>
          ))}
          {compact && categories.length > 8 && (
            <button type="button" className="min-h-11 px-2 text-sm text-muted underline-offset-4 hover:underline" onClick={() => setShowAllCats((v) => !v)}>
              {showAllCats ? "Fewer" : `+${categories.length - 8} more`}
            </button>
          )}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <p className="mb-2 text-sm font-medium" id={`${id}-b`}>
            Bucket
          </p>
          <SegmentedControl
            label="Bucket"
            value={value.bucketId}
            onChange={(b) => set({ bucketId: b })}
            options={buckets.map((b) => ({ value: b.id, label: b.name, color: b.color }))}
          />
        </div>
        <Field label="Date" htmlFor={`${id}-date`} className="w-44">
          <TextInput id={`${id}-date`} type="date" value={value.date} onChange={(e) => set({ date: e.target.value })} required />
        </Field>
        <Field label="Pay period" htmlFor={`${id}-cut`} className="min-w-52 flex-1">
          <Select id={`${id}-cut`} value={value.cutoffOverride ?? "auto"} onChange={(e) => set({ cutoffOverride: e.target.value === "auto" ? null : e.target.value })}>
            <option value="auto">Auto · {cutoffLabel(autoCutoff, paydays)}</option>
            {[prevCutoffId(autoCutoff), nextCutoffId(autoCutoff)].map((c) => (
              <option key={c} value={c}>
                {cutoffLabel(c, paydays)}
              </option>
            ))}
            {value.cutoffOverride && value.cutoffOverride !== prevCutoffId(autoCutoff) && value.cutoffOverride !== nextCutoffId(autoCutoff) && (
              <option value={value.cutoffOverride}>{cutoffLabel(value.cutoffOverride, paydays)}</option>
            )}
          </Select>
        </Field>
      </div>

      <div className="flex items-center justify-end gap-2">
        {extraActions}
        <Button type="submit" size="lg" disabled={!canSave}>
          {submitLabel}
          <KeyboardHint keys={["↵"]} className="[&_kbd]:border-accent-ink/30 [&_kbd]:bg-transparent [&_kbd]:text-accent-ink/70" />
        </Button>
      </div>
    </form>
  );
}
