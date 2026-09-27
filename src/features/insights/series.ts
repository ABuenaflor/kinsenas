import { periodMetrics, monthCutoffIds, type MetricsData, type PeriodMetrics } from "@/domain/metrics";
import type { Centavos, Expense } from "@/domain/types";
import { cutoffLabel, makeCutoffId, monthKeysBetween, monthLabel, parseCutoffId, shiftMonthKey } from "@/lib/periods";
import type { Paydays } from "@/domain/types";

export type RangeKey = "3" | "6" | "12" | "ytd" | "custom";
export type Granularity = "month" | "cutoff";

export interface SeriesPoint {
  key: string;
  label: string;
  ids: string[];
  m: PeriodMetrics;
  net: Centavos;
  gross: Centavos;
  saved: Centavos;
  spent: Centavos;
  unspent: Centavos;
  deductions: Centavos;
  cumulativeSaved: Centavos;
}

export function monthsForRange(range: RangeKey, endMonth: string, custom?: { from: string; to: string }): string[] {
  if (range === "custom" && custom) return monthKeysBetween(custom.from <= custom.to ? custom.from : custom.to, custom.from <= custom.to ? custom.to : custom.from);
  if (range === "custom") return monthKeysBetween(shiftMonthKey(endMonth, -5), endMonth);
  if (range === "ytd") return monthKeysBetween(`${endMonth.slice(0, 4)}-01`, endMonth);
  const n = Number(range);
  return monthKeysBetween(shiftMonthKey(endMonth, -(n - 1)), endMonth);
}

/** One point per month (or cutoff) with the headline measures. */
export function buildSeries(months: string[], granularity: Granularity, data: MetricsData, paydays: Paydays): SeriesPoint[] {
  const periods =
    granularity === "month"
      ? months.map((k) => ({ key: k, label: monthLabel(k), ids: monthCutoffIds(k) }))
      : months.flatMap((k) => {
          const [y = 0, mo = 1] = k.split("-").map(Number);
          return (["A", "B"] as const).map((h) => {
            const id = makeCutoffId(y, mo, h);
            return { key: id, label: `${monthLabel(k)} ${parseCutoffId(id).half === "A" ? "·1" : "·2"}`, ids: [id], title: cutoffLabel(id, paydays) };
          });
        });
  let cum = 0;
  return periods.map((p) => {
    const m = periodMetrics(p.ids, data);
    cum += m.saved;
    return {
      key: p.key,
      label: p.label,
      ids: p.ids,
      m,
      net: m.net,
      gross: m.gross,
      saved: m.saved,
      spent: m.spent,
      unspent: m.unspent,
      deductions: m.totalDeductions,
      cumulativeSaved: cum,
    };
  });
}

/** Expenses attributed to any of the given cutoffs, optionally for one bucket. */
export function expensesIn(expenses: readonly Expense[], ids: readonly string[], bucketId: string | null): Expense[] {
  const set = new Set(ids);
  return expenses.filter((e) => set.has(e.cutoffId) && (!bucketId || e.bucketId === bucketId));
}

/** Top-N categories by spend, rest folded into "Others". */
export function topCategories(expenses: readonly Expense[], n = 8): { categoryId: string; amount: Centavos }[] {
  const totals = new Map<string, Centavos>();
  for (const e of expenses) totals.set(e.categoryId, (totals.get(e.categoryId) ?? 0) + e.amount);
  const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([categoryId, amount]) => ({ categoryId, amount }));
  if (sorted.length <= n) return sorted;
  const rest = sorted.slice(n).reduce((s, x) => s + x.amount, 0);
  return [...sorted.slice(0, n), { categoryId: "__others", amount: rest }];
}

/** Signed change for ▲/▼ deltas; null when there's no baseline. */
export function delta(curr: number, prev: number | undefined): number | null {
  if (prev === undefined || prev === 0) return null;
  return (curr - prev) / Math.abs(prev);
}
