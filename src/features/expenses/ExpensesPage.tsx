import { m } from "motion/react";
import { Download } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader, PeriodSwitcher } from "@/components/layout/PeriodSwitcher";
import { Button } from "@/components/ui/Button";
import { Card, SectionTitle } from "@/components/ui/Card";
import { TextInput, SegmentedControl } from "@/components/ui/inputs";
import { NumberTicker } from "@/components/ui/NumberTicker";
import { ProgressBar } from "@/components/ui/progress";
import { useIsDesktop } from "@/hooks/useMedia";
import { cn } from "@/lib/cn";
import { toCsv, downloadFile } from "@/lib/csv";
import { formatMoney, ratio } from "@/lib/money";
import { todayISO } from "@/lib/periods";
import { useBucketMap, useCategoryMap } from "@/store/selectors";
import { useStore } from "@/store/useStore";
import { useUi } from "@/store/useUi";
import { toast } from "@/components/ui/Toast";
import { ExpenseForm, initialForm, useRecentCategories, type ExpenseFormValue } from "./ExpenseForm";
import { ExpenseList } from "./ExpenseList";
import { FiltersBar } from "./FiltersBar";
import { useExpenseView, type Scope } from "./useExpenseView";

function Stat({ label, value, tone, sub }: { label: string; value: React.ReactNode; tone?: "danger" | "success"; sub?: string }) {
  return (
    <div className="min-w-0">
      <p className="eyebrow">{label}</p>
      <p className={cn("money mt-1 truncate text-lg font-semibold", tone === "danger" && "text-danger", tone === "success" && "text-success")}>{value}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  );
}

function InlineQuickAdd() {
  const categories = useRecentCategories();
  const paydays = useStore((s) => s.settings.paydays);
  const [value, setValue] = useState<ExpenseFormValue>(() => initialForm(paydays, undefined, undefined, categories[0]));
  return (
    <Card className="mb-6">
      <SectionTitle eyebrow="Quick add" title="Log spending" />
      <ExpenseForm
        compact
        value={value}
        onChange={setValue}
        submitLabel="Add"
        onSubmit={() => {
          if (value.amount === null) return;
          const s = useStore.getState();
          const snap = s.snapshot();
          const added = s.addExpense({
            amount: value.amount,
            categoryId: value.categoryId,
            bucketId: value.bucketId,
            date: value.date,
            note: value.note,
            cutoffId: value.cutoffOverride ?? undefined,
          });
          useUi.getState().markAdded(added.id, "inline");
          toast(`Added ${formatMoney(value.amount)}`, { tone: "success", undo: () => useStore.getState().restore(snap) });
          setValue((v) => ({ ...v, amount: null, note: "" }));
        }}
      />
    </Card>
  );
}

export default function ExpensesPage() {
  const view = useExpenseView();
  const { metrics, scope } = view;
  const desktop = useIsDesktop();
  const openExpense = useUi((s) => s.openExpense);
  const catMap = useCategoryMap();
  const bucketMap = useBucketMap();

  const byCategory = useMemo(() => {
    const totals = new Map<string, number>();
    for (const e of view.filtered) totals.set(e.categoryId, (totals.get(e.categoryId) ?? 0) + e.amount);
    return [...totals.entries()].sort((a, b) => b[1] - a[1]);
  }, [view.filtered]);
  const maxCat = byCategory[0]?.[1] ?? 0;

  const spent = scope === "range" ? view.inScopeTotal : metrics.spent;
  const remaining = metrics.allocated - spent - metrics.earmarked;

  const exportCsv = () => {
    const rows = view.filtered.map((e) => [
      e.date,
      e.cutoffId,
      catMap.get(e.categoryId)?.name ?? e.categoryId,
      bucketMap.get(e.bucketId)?.name ?? e.bucketId,
      (e.amount / 100).toFixed(2),
      e.note ?? "",
    ]);
    downloadFile(`kinsenas-expenses-${todayISO()}.csv`, toCsv(["Date", "Pay period", "Category", "Bucket", "Amount (PHP)", "Note"], rows), "text/csv;charset=utf-8");
  };

  return (
    <div>
      <PageHeader eyebrow="Expenses" title="Where did it go?">
        {(scope === "cutoff" || scope === "month") && <PeriodSwitcher />}
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SegmentedControl<Scope>
          label="Period"
          value={scope}
          onChange={view.setScope}
          layoutId="exp-scope"
          options={[
            { value: "cutoff", label: "Cutoff" },
            { value: "month", label: "Month" },
            { value: "range", label: "Range" },
            { value: "all", label: "All time" },
          ]}
        />
        {scope === "range" && (
          <div className="flex items-center gap-2">
            <TextInput type="date" aria-label="From" value={view.range.from} onChange={(e) => view.setRange((r) => ({ ...r, from: e.target.value }))} className="w-40" />
            <span className="text-muted">→</span>
            <TextInput type="date" aria-label="To" value={view.range.to} onChange={(e) => view.setRange((r) => ({ ...r, to: e.target.value }))} className="w-40" />
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <p className="eyebrow">Total spent</p>
          <div className="mt-1 text-4xl font-semibold md:text-5xl" aria-live="polite">
            <NumberTicker value={spent} />
          </div>
          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Allocated" value={formatMoney(metrics.allocated)} />
            <Stat label="Remaining" value={formatMoney(remaining)} tone={remaining < 0 ? "danger" : undefined} sub={metrics.earmarked ? `after ${formatMoney(metrics.earmarked)} set aside` : undefined} />
            <Stat label="Transactions" value={view.inScope.length} />
            <Stat label="Daily avg" value={formatMoney(Math.round(spent / view.spanDays))} />
          </div>
        </Card>
        <Card>
          <p className="eyebrow mb-3">By bucket</p>
          <ul className="space-y-3.5">
            {metrics.buckets
              .filter((b) => b.allocated > 0 || b.spent > 0)
              .map((b) => {
                const used = b.spent + b.earmarked;
                const over = used > b.allocated;
                return (
                  <li key={b.bucketId}>
                    <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                      <span className="flex items-center gap-2 font-medium">
                        <span aria-hidden className="size-2.5 rounded-full" style={{ background: b.color }} />
                        {b.name}
                      </span>
                      <span className="money text-xs text-muted">
                        {formatMoney(b.spent)} / {formatMoney(b.allocated)}
                      </span>
                    </div>
                    <ProgressBar value={b.allocated ? used / b.allocated : used > 0 ? Infinity : 0} color={b.color} label={`${b.name} spent`} />
                    <m.p
                      key={over ? "over" : "ok"}
                      animate={over ? { x: [0, -4, 4, -2, 0] } : undefined}
                      className={cn("money mt-1 text-xs", over ? "text-danger" : "text-muted")}
                    >
                      {over ? `${formatMoney(-b.remaining)} over` : `${formatMoney(b.remaining)} left`}
                    </m.p>
                  </li>
                );
              })}
            {metrics.allocated === 0 && <li className="text-sm text-muted">No payday logged for this period — spending shows as unfunded.</li>}
          </ul>
        </Card>
      </div>

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          {desktop ? (
            <InlineQuickAdd />
          ) : (
            <Button size="lg" className="mb-4 w-full" onClick={() => openExpense()}>
              + Add expense
            </Button>
          )}
          <div className="mb-4">
            <FiltersBar filters={view.filters} onChange={view.setFilters} count={view.activeFilterCount} />
          </div>
          <div className="mb-3 flex items-center justify-between text-sm text-muted">
            <span>
              {view.filtered.length} shown · <span className="money">{formatMoney(view.filteredTotal)}</span>
            </span>
            <Button variant="ghost" size="sm" onClick={exportCsv} disabled={view.filtered.length === 0}>
              <Download className="size-4" /> CSV
            </Button>
          </div>
          <h2 className="sr-only">Transactions</h2>
          <ExpenseList days={view.days} />
        </div>
        <Card className="lg:sticky lg:top-28">
          <p className="eyebrow mb-3">By category</p>
          {byCategory.length === 0 ? (
            <p className="text-sm text-muted">Nothing yet.</p>
          ) : (
            <ul className="space-y-3">
              {byCategory.map(([id, total]) => {
                const c = catMap.get(id);
                return (
                  <li key={id}>
                    <div className="mb-1 flex justify-between gap-2 text-sm">
                      <span className="truncate">
                        <span aria-hidden>{c?.emoji}</span> {c?.name ?? "Unknown"}
                      </span>
                      <span className="money shrink-0 text-xs">{formatMoney(total)}</span>
                    </div>
                    <ProgressBar value={ratio(total, maxCat)} color={c?.color ?? "var(--ink)"} label={`${c?.name} share`} />
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
