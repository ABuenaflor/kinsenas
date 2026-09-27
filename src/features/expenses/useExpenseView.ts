import { useMemo, useState } from "react";
import { allCutoffIds } from "@/domain/metrics";
import type { Centavos, CutoffId, Expense } from "@/domain/types";
import { addDays, daysBetween, monthKey, nextCutoffId, periodOf, periodRange, todayISO } from "@/lib/periods";
import { scopeIds, useMetrics } from "@/store/selectors";
import { useStore } from "@/store/useStore";

export type Scope = "cutoff" | "month" | "range" | "all";

export interface Filters {
  search: string;
  categoryIds: string[];
  bucketId: string | null;
  min: Centavos | null;
  max: Centavos | null;
}

export const EMPTY_FILTERS: Filters = { search: "", categoryIds: [], bucketId: null, min: null, max: null };

function cutoffIdsInRange(from: string, to: string, paydays: Parameters<typeof periodOf>[1]): CutoffId[] {
  const ids: CutoffId[] = [];
  let id = periodOf(from, paydays);
  const last = periodOf(to, paydays);
  for (let i = 0; i < 400 && id <= last; i++) {
    ids.push(id);
    id = nextCutoffId(id);
  }
  return ids;
}

/** Scope + filters → the expenses in view, their metrics, and day groups. */
export function useExpenseView() {
  const [scope, setScope] = useState<Scope>("cutoff");
  const [range, setRange] = useState(() => ({ from: addDays(todayISO(), -29), to: todayISO() }));
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const period = useStore((s) => s.ui.period);
  const paydays = useStore((s) => s.settings.paydays);
  const cutoffs = useStore((s) => s.cutoffs);
  const expenses = useStore((s) => s.expenses);
  const toBuy = useStore((s) => s.toBuy);
  const categories = useStore((s) => s.categories);

  const ids = useMemo(() => {
    if (scope === "range") return cutoffIdsInRange(range.from, range.to, paydays);
    return scopeIds(scope === "all" ? "all" : scope, period, allCutoffIds({ cutoffs, expenses, toBuy }));
  }, [scope, range, paydays, period, cutoffs, expenses, toBuy]);
  const metrics = useMetrics(ids);

  const inScope = useMemo(() => {
    if (scope === "range") return expenses.filter((e) => e.date >= range.from && e.date <= range.to);
    const set = new Set(ids);
    return expenses.filter((e) => set.has(e.cutoffId));
  }, [scope, range, ids, expenses]);

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    const catName = new Map(categories.map((c) => [c.id, c.name.toLowerCase()]));
    return inScope
      .filter((e) => {
        if (q && !(e.note ?? "").toLowerCase().includes(q) && !(catName.get(e.categoryId) ?? "").includes(q)) return false;
        if (filters.categoryIds.length && !filters.categoryIds.includes(e.categoryId)) return false;
        if (filters.bucketId && e.bucketId !== filters.bucketId) return false;
        if (filters.min !== null && e.amount < filters.min) return false;
        if (filters.max !== null && e.amount > filters.max) return false;
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  }, [inScope, filters, categories]);

  const days = useMemo(() => {
    const map = new Map<string, Expense[]>();
    for (const e of filtered) map.set(e.date, [...(map.get(e.date) ?? []), e]);
    return [...map.entries()].map(([date, rows]) => ({ date, rows, total: rows.reduce((s, r) => s + r.amount, 0) }));
  }, [filtered]);

  const spanDays = useMemo(() => {
    const today = todayISO();
    if (scope === "range") return Math.max(1, daysBetween(range.from, range.to) + 1);
    if (scope === "cutoff") {
      const { start, end } = periodRange(period, paydays);
      return Math.max(1, daysBetween(start, today < end ? today : end) + 1);
    }
    if (scope === "month") {
      const first = periodRange(`${monthKey(period)}-A`, paydays).start;
      const last = periodRange(`${monthKey(period)}-B`, paydays).end;
      return Math.max(1, daysBetween(first, today < last ? today : last) + 1);
    }
    const dates = expenses.map((e) => e.date).sort();
    return dates.length ? Math.max(1, daysBetween(dates[0] ?? today, today) + 1) : 1;
  }, [scope, range, period, paydays, expenses]);

  const inScopeTotal = inScope.reduce((s, e) => s + e.amount, 0);
  const filteredTotal = filtered.reduce((s, e) => s + e.amount, 0);
  const activeFilterCount =
    (filters.search ? 1 : 0) + filters.categoryIds.length + (filters.bucketId ? 1 : 0) + (filters.min !== null ? 1 : 0) + (filters.max !== null ? 1 : 0);

  return {
    scope,
    setScope,
    range,
    setRange,
    filters,
    setFilters,
    metrics,
    inScope,
    inScopeTotal,
    filtered,
    filteredTotal,
    days,
    spanDays,
    activeFilterCount,
  };
}
