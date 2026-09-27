import { useMemo } from "react";
import { computeCutoff, type CutoffInput } from "@/domain/computeCutoff";
import { allCutoffIds, monthCutoffIds, periodMetrics, type PeriodMetrics } from "@/domain/metrics";
import type { Bucket, Category, CutoffId } from "@/domain/types";
import { monthKey } from "@/lib/periods";
import { contextOf } from "./slices/payday";
import { useStore } from "./useStore";

export type PeriodScope = "cutoff" | "month" | "all";

export function useActiveBuckets(): Bucket[] {
  const buckets = useStore((s) => s.buckets);
  return useMemo(() => buckets.filter((b) => !b.archived).sort((a, b) => a.order - b.order), [buckets]);
}

export function useActiveCategories(): Category[] {
  const categories = useStore((s) => s.categories);
  return useMemo(() => categories.filter((c) => !c.archived), [categories]);
}

export function useBucketMap(): Map<string, Bucket> {
  const buckets = useStore((s) => s.buckets);
  return useMemo(() => new Map(buckets.map((b) => [b.id, b])), [buckets]);
}

export function useCategoryMap(): Map<string, Category> {
  const categories = useStore((s) => s.categories);
  return useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
}

export function scopeIds(scope: PeriodScope, period: CutoffId, all: CutoffId[]): CutoffId[] {
  if (scope === "cutoff") return [period];
  if (scope === "month") return monthCutoffIds(monthKey(period));
  return all;
}

/** Memoized metrics for a set of cutoff ids. */
export function useMetrics(ids: CutoffId[]): PeriodMetrics {
  const cutoffs = useStore((s) => s.cutoffs);
  const expenses = useStore((s) => s.expenses);
  const toBuy = useStore((s) => s.toBuy);
  const buckets = useStore((s) => s.buckets);
  const key = ids.join("|");
  return useMemo(
    () => periodMetrics(key ? key.split("|") : [], { cutoffs, expenses, toBuy, buckets }),
    [key, cutoffs, expenses, toBuy, buckets],
  );
}

export function useScopeMetrics(scope: PeriodScope): PeriodMetrics {
  const period = useStore((s) => s.ui.period);
  const cutoffs = useStore((s) => s.cutoffs);
  const expenses = useStore((s) => s.expenses);
  const toBuy = useStore((s) => s.toBuy);
  const all = useMemo(() => allCutoffIds({ cutoffs, expenses, toBuy }), [cutoffs, expenses, toBuy]);
  return useMetrics(scopeIds(scope, period, all));
}

/** Live preview of a cutoff draft using the current settings. */
export function useCutoffPreview(input: CutoffInput) {
  const settings = useStore((s) => s.settings);
  const govRates = useStore((s) => s.govRates);
  const govDeductions = useStore((s) => s.govDeductions);
  const customDeductions = useStore((s) => s.customDeductions);
  const buckets = useStore((s) => s.buckets);
  const rules = useStore((s) => s.rules);
  const { cutoffId, gross, govAlreadyDeducted, ruleId, adjustments } = input;
  return useMemo(
    () =>
      computeCutoff(
        { cutoffId, gross, govAlreadyDeducted, ruleId, adjustments },
        contextOf({ settings, govRates, govDeductions, customDeductions, buckets, rules }),
      ),
    [cutoffId, gross, govAlreadyDeducted, ruleId, adjustments, settings, govRates, govDeductions, customDeductions, buckets, rules],
  );
}
