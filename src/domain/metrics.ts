import { sum } from "@/lib/money";
import { monthKey } from "@/lib/periods";
import { isEarmarking } from "./toBuy";
import type { Bucket, Centavos, Cutoff, CutoffId, Expense, ToBuyItem } from "./types";

export interface BucketTotals {
  bucketId: string;
  name: string;
  color: string;
  countsAsSavings: boolean;
  allocated: Centavos;
  spent: Centavos;
  earmarked: Centavos;
  remaining: Centavos; // allocated − spent − earmarked; negative = overspent
}

export interface PeriodMetrics {
  cutoffIds: CutoffId[];
  cutoffCount: number;
  gross: Centavos;
  totalDeductions: Centavos;
  deductionsByKey: Record<string, { label: string; amount: Centavos }>;
  net: Centavos;
  allocated: Centavos;
  spent: Centavos;
  earmarked: Centavos;
  saved: Centavos;
  unspent: Centavos;
  overspent: Centavos;
  savingsRate: number; // saved ÷ net (display only)
  buckets: BucketTotals[];
  byCategory: Record<string, Centavos>;
  txCount: number;
}

export interface MetricsData {
  cutoffs: readonly Cutoff[];
  expenses: readonly Expense[];
  toBuy: readonly ToBuyItem[];
  buckets: readonly Bucket[];
}

/** Metrics for any set of cutoffs (one cutoff, a month's A + B, a range…). */
export function periodMetrics(ids: Iterable<CutoffId>, data: MetricsData): PeriodMetrics {
  const idSet = new Set(ids);
  const cutoffs = data.cutoffs.filter((c) => idSet.has(c.id));
  const expenses = data.expenses.filter((e) => idSet.has(e.cutoffId));

  const totals = new Map<string, BucketTotals>();
  const ensure = (bucketId: string, fallback?: { name: string; color: string; countsAsSavings: boolean }) => {
    let t = totals.get(bucketId);
    if (!t) {
      const b = data.buckets.find((x) => x.id === bucketId);
      t = {
        bucketId,
        name: b?.name ?? fallback?.name ?? "Unknown",
        color: b?.color ?? fallback?.color ?? "var(--deduction)",
        countsAsSavings: b?.countsAsSavings ?? fallback?.countsAsSavings ?? false,
        allocated: 0,
        spent: 0,
        earmarked: 0,
        remaining: 0,
      };
      totals.set(bucketId, t);
    }
    return t;
  };

  for (const b of [...data.buckets].sort((a, z) => a.order - z.order)) if (!b.archived) ensure(b.id);

  const deductionsByKey: PeriodMetrics["deductionsByKey"] = {};
  for (const c of cutoffs) {
    for (const a of c.allocations) ensure(a.bucketId, a).allocated += a.amount;
    for (const d of c.deductions) {
      const entry = (deductionsByKey[d.key] ??= { label: d.label, amount: 0 });
      entry.amount += d.amount;
    }
  }
  const byCategory: Record<string, Centavos> = {};
  for (const e of expenses) {
    ensure(e.bucketId).spent += e.amount;
    byCategory[e.categoryId] = (byCategory[e.categoryId] ?? 0) + e.amount;
  }
  for (const item of data.toBuy) {
    if (!isEarmarking(item)) continue;
    const inPeriod = sum(item.contributions.filter((c) => idSet.has(c.cutoffId)).map((c) => c.amount));
    if (inPeriod !== 0) ensure(item.bucketId).earmarked += inPeriod;
  }

  const buckets = [...totals.values()].map((t) => ({ ...t, remaining: t.allocated - t.spent - t.earmarked }));
  const net = sum(cutoffs.map((c) => c.net));
  const saved = sum(buckets.filter((b) => b.countsAsSavings).map((b) => b.allocated - b.spent));
  const spent = sum(expenses.map((e) => e.amount));

  return {
    cutoffIds: [...idSet].sort(),
    cutoffCount: cutoffs.length,
    gross: sum(cutoffs.map((c) => c.gross)),
    totalDeductions: sum(cutoffs.map((c) => c.totalDeductions)),
    deductionsByKey,
    net,
    allocated: sum(buckets.map((b) => b.allocated)),
    spent,
    earmarked: sum(buckets.map((b) => b.earmarked)),
    saved,
    unspent: sum(buckets.filter((b) => !b.countsAsSavings).map((b) => Math.max(0, b.remaining))),
    overspent: sum(buckets.map((b) => Math.max(0, -b.remaining))),
    savingsRate: net > 0 ? saved / net : 0,
    buckets,
    byCategory,
    txCount: expenses.length,
  };
}

export function monthCutoffIds(key: string): CutoffId[] {
  return [`${key}-A`, `${key}-B`];
}

/** Every cutoff id referenced anywhere (for "All time"). */
export function allCutoffIds(data: Pick<MetricsData, "cutoffs" | "expenses" | "toBuy">): CutoffId[] {
  const ids = new Set<CutoffId>();
  for (const c of data.cutoffs) ids.add(c.id);
  for (const e of data.expenses) ids.add(e.cutoffId);
  for (const t of data.toBuy) for (const c of t.contributions) ids.add(c.cutoffId);
  return [...ids].sort();
}

/** Month keys that have any activity, ascending. */
export function activeMonths(data: Pick<MetricsData, "cutoffs" | "expenses" | "toBuy">): string[] {
  return [...new Set(allCutoffIds(data).map(monthKey))].sort();
}

/** Σ amounts per day (ISO date) — used by the spending calendar. */
export function dailySpend(expenses: readonly Expense[]): Map<string, Centavos> {
  const out = new Map<string, Centavos>();
  for (const e of expenses) out.set(e.date, (out.get(e.date) ?? 0) + e.amount);
  return out;
}
