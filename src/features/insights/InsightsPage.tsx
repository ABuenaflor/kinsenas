import { useMemo, useState } from "react";
import { PageHeader, PeriodSwitcher } from "@/components/layout/PeriodSwitcher";
import { Button } from "@/components/ui/Button";
import { SegmentedControl, Select } from "@/components/ui/inputs";
import { EmptyState } from "@/components/ui/misc";
import { toast } from "@/components/ui/Toast";
import { useReduced } from "@/hooks/useMedia";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";
import { monthKey, monthLabel, monthKeysBetween, shiftMonthKey } from "@/lib/periods";
import { MonthPicker } from "@/components/ui/MonthPicker";
import { useActiveBuckets, useCategoryMap } from "@/store/selectors";
import { useStore } from "@/store/useStore";
import { AllocatedVsSpent, MonthlyFlowChart, SavingsOverTime, SpendingByCategory, SpendingCalendar, WhereGrossWent } from "./charts";
import { buildSeries, delta, expensesIn, monthsForRange, topCategories, type Granularity, type RangeKey } from "./series";

function Sparkline({ values, color = "var(--ink)" }: { values: number[]; color?: string }) {
  if (values.length < 2) return <div className="h-8" />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${28 - ((v - min) / span) * 24}`).join(" ");
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="h-8 w-full" aria-hidden>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function Kpi({ label, value, d: rawDelta, spark, color, goodWhenUp = true }: { label: string; value: string; d: number | null; spark: number[]; color?: string; goodWhenUp?: boolean }) {
  const d = rawDelta !== null && Math.abs(rawDelta) < 0.0005 ? 0 : rawDelta; // flat, not ▼ -0.0%
  const up = d !== null && d > 0;
  const good = d === null || d === 0 ? null : up === goodWhenUp;
  return (
    <div className="card flex flex-col gap-1 p-4">
      <p className="eyebrow">{label}</p>
      <p className="money truncate text-xl font-semibold">{value}</p>
      <p className={cn("money text-xs", good === null ? "text-muted" : good ? "text-success" : "text-danger")}>
        {d === null ? "— no prior period" : d === 0 ? "no change vs prev" : `${up ? "▲ +" : "▼ "}${(d * 100).toFixed(1)}% vs prev`}
      </p>
      <Sparkline values={spark} color={color} />
    </div>
  );
}

export default function InsightsPage() {
  const period = useStore((s) => s.ui.period);
  const paydays = useStore((s) => s.settings.paydays);
  const cutoffs = useStore((s) => s.cutoffs);
  const expenses = useStore((s) => s.expenses);
  const toBuy = useStore((s) => s.toBuy);
  const allBuckets = useStore((s) => s.buckets);
  const loadDemo = useStore((s) => s.loadDemo);
  const buckets = useActiveBuckets();
  const catMap = useCategoryMap();
  const reduced = useReduced();
  const [range, setRange] = useState<RangeKey>("6");
  const [gran, setGran] = useState<Granularity>("month");
  const [bucketId, setBucketId] = useState<string | null>(null);

  const selMonth = monthKey(period);
  const [custom, setCustom] = useState(() => ({ from: shiftMonthKey(selMonth, -5), to: selMonth }));
  const months = useMemo(() => monthsForRange(range, selMonth, custom), [range, selMonth, custom]);
  const data = useMemo(() => ({ cutoffs, expenses, toBuy, buckets: allBuckets }), [cutoffs, expenses, toBuy, allBuckets]);
  const series = useMemo(() => buildSeries(months, gran, data, paydays), [months, gran, data, paydays]);
  const monthly = useMemo(() => (gran === "month" ? series : buildSeries(months, "month", data, paydays)), [gran, series, months, data, paydays]);
  // KPI tiles always describe the selected month vs the one before, whatever the chart range.
  const kpiPair = useMemo(() => buildSeries([shiftMonthKey(selMonth, -1), selMonth], "month", data, paydays), [selMonth, data, paydays]);
  const current = kpiPair[1];
  const prev = kpiPair[0] && kpiPair[0].m.cutoffCount + kpiPair[0].m.txCount > 0 ? kpiPair[0] : undefined;

  const rangeIds = useMemo(() => series.flatMap((s) => s.ids), [series]);
  const rangeExpenses = useMemo(() => expensesIn(expenses, rangeIds, bucketId), [expenses, rangeIds, bucketId]);
  const cats = useMemo(() => topCategories(rangeExpenses), [rangeExpenses]);
  const monthExpenses = useMemo(() => expensesIn(expenses, [`${selMonth}-A`, `${selMonth}-B`], bucketId), [expenses, selMonth, bucketId]);
  const bigCat = topCategories(monthExpenses, 1)[0];

  const ytd = useMemo(
    () => buildSeries(monthKeysBetween(`${selMonth.slice(0, 4)}-01`, selMonth), "month", data, paydays).reduce((s, p) => s + p.deductions, 0),
    [selMonth, data, paydays],
  );

  const bucketMeta = buckets.map((b) => ({ id: b.id, name: b.name, color: b.color }));
  const currentBuckets = (current?.m.buckets ?? []).filter((b) => !bucketId || b.bucketId === bucketId);

  if (cutoffs.length === 0 && expenses.length === 0) {
    return (
      <div>
        <PageHeader eyebrow="Insights" title="How the money moves" />
        <EmptyState
          title="Log your first payday to see insights"
          body="Charts fill in as you save cutoffs and log spending."
          action={
            <Button
              variant="outline"
              onClick={async () => {
                const snap = useStore.getState().snapshot();
                await loadDemo();
                toast("Loaded 6 months of demo data", { undo: () => useStore.getState().restore(snap) });
              }}
            >
              Load demo data
            </Button>
          }
        />
      </div>
    );
  }

  const avgPerCutoff = current && current.m.cutoffCount > 0 ? Math.round(current.spent / current.m.cutoffCount) : (current?.spent ?? 0);
  const prevAvg = prev && prev.m.cutoffCount > 0 ? Math.round(prev.spent / prev.m.cutoffCount) : undefined;

  return (
    <div>
      <PageHeader eyebrow="Insights" title="How the money moves">
        <PeriodSwitcher />
      </PageHeader>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <SegmentedControl<RangeKey>
          label="Range"
          size="sm"
          layoutId="ins-range"
          value={range}
          onChange={setRange}
          options={[
            { value: "3", label: "3 mo" },
            { value: "6", label: "6 mo" },
            { value: "12", label: "12 mo" },
            { value: "ytd", label: "YTD" },
            { value: "custom", label: "Custom" },
          ]}
        />
        {range === "custom" && (
          <div className="flex items-center gap-2">
            <MonthPicker label="From" value={custom.from} max={custom.to} onChange={(v) => v && setCustom((c) => ({ ...c, from: v }))} className="w-40" />
            <span className="text-muted" aria-hidden>→</span>
            <MonthPicker label="To" value={custom.to} min={custom.from} onChange={(v) => v && setCustom((c) => ({ ...c, to: v }))} className="w-40" />
          </div>
        )}
        <SegmentedControl<Granularity>
          label="Granularity"
          size="sm"
          layoutId="ins-gran"
          value={gran}
          onChange={setGran}
          options={[
            { value: "month", label: "Month" },
            { value: "cutoff", label: "Cutoff" },
          ]}
        />
        <Select aria-label="Bucket filter" value={bucketId ?? ""} onChange={(e) => setBucketId(e.target.value || null)} className="w-44">
          <option value="">All buckets</option>
          {buckets.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </Select>
      </div>

      <section aria-label={`Key numbers for ${monthLabel(selMonth, true)}`} className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Saved this month" value={formatMoney(current?.saved ?? 0)} d={delta(current?.saved ?? 0, prev?.saved)} spark={monthly.map((m) => m.saved)} color="var(--savings)" />
        <Kpi
          label="Savings rate"
          value={`${((current?.m.savingsRate ?? 0) * 100).toFixed(1)}%`}
          d={delta(current?.m.savingsRate ?? 0, prev?.m.savingsRate)}
          spark={monthly.map((m) => m.m.savingsRate)}
          color="var(--savings)"
        />
        <Kpi label="Total spent" value={formatMoney(current?.spent ?? 0)} d={delta(current?.spent ?? 0, prev?.spent)} spark={monthly.map((m) => m.spent)} color="var(--wants)" goodWhenUp={false} />
        <Kpi label="Avg spend / cutoff" value={formatMoney(avgPerCutoff)} d={delta(avgPerCutoff, prevAvg)} spark={monthly.map((m) => (m.m.cutoffCount ? m.spent / m.m.cutoffCount : m.spent))} goodWhenUp={false} />
        <Kpi
          label="Biggest category"
          value={bigCat ? `${catMap.get(bigCat.categoryId)?.emoji ?? ""} ${catMap.get(bigCat.categoryId)?.name ?? "—"}` : "—"}
          d={null}
          spark={[]}
        />
        <Kpi label="Deductions YTD" value={formatMoney(ytd)} d={null} spark={monthly.map((m) => m.deductions)} color="var(--deduction)" />
      </section>

      <div className="grid gap-6">
        <MonthlyFlowChart data={series} animate={!reduced} />
        <div className="grid gap-6 lg:grid-cols-2">
          <AllocatedVsSpent buckets={currentBuckets} monthLabelText={monthLabel(selMonth, true)} />
          <SavingsOverTime data={series} animate={!reduced} />
        </div>
        <WhereGrossWent data={series} bucketMeta={bucketMeta} animate={!reduced} />
        <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <SpendingByCategory rows={cats} categories={catMap} animate={!reduced} />
          <SpendingCalendar monthKey={selMonth} expenses={monthExpenses} />
        </div>
      </div>
    </div>
  );
}
