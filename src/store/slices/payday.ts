import { buildCutoff, type CutoffContext, type CutoffInput } from "@/domain/computeCutoff";
import { autoContributionFor, nextStatus } from "@/domain/toBuy";
import type { Centavos, Cutoff, CutoffId, ToBuyItem } from "@/domain/types";
import { newId } from "@/lib/ids";
import type { AppData } from "../types";
import type { Get, Set } from "../useStore";

export interface PaydaySlice {
  /** Save (create or update) a cutoff. Returns the snapshot and auto set-aside total. */
  saveCutoff: (input: CutoffInput & { note?: string }) => { cutoff: Cutoff; setAside: Centavos; created: boolean };
  deleteCutoff: (id: CutoffId) => void;
  /** Recompute a stored cutoff with current rates, deductions, and its rule's current definition. */
  reapplyCutoff: (id: CutoffId) => void;
}

export function contextOf(s: Pick<AppData, "settings" | "govRates" | "govDeductions" | "customDeductions" | "buckets" | "rules">): CutoffContext {
  return {
    settings: s.settings,
    govRates: s.govRates,
    govDeductions: s.govDeductions,
    customDeductions: s.customDeductions,
    buckets: s.buckets,
    rules: s.rules,
  };
}

/** Add the auto set-aside for `cutoff` to every item that doesn't have one for it yet. */
function applyAutoSetAsides(items: ToBuyItem[], cutoff: Cutoff): { items: ToBuyItem[]; total: Centavos } {
  let total = 0;
  const next = items.map((item) => {
    if (item.contributions.some((c) => c.auto && c.cutoffId === cutoff.id)) return item;
    const amount = autoContributionFor(item, cutoff.allocations);
    if (amount <= 0) return item;
    total += amount;
    const updated: ToBuyItem = {
      ...item,
      contributions: [...item.contributions, { id: newId(), cutoffId: cutoff.id, amount, date: cutoff.payDate, auto: true }],
    };
    return { ...updated, status: nextStatus(updated) };
  });
  return { items: next, total };
}

export const paydaySlice = (set: Set, get: Get): PaydaySlice => ({
  saveCutoff: (input) => {
    const s = get();
    const existing = s.cutoffs.find((c) => c.id === input.cutoffId);
    const cutoff = buildCutoff(input, contextOf(s), new Date().toISOString(), existing);
    const { items, total } = applyAutoSetAsides(s.toBuy, cutoff);
    const cutoffs = existing ? s.cutoffs.map((c) => (c.id === cutoff.id ? cutoff : c)) : [...s.cutoffs, cutoff];
    set({ cutoffs, toBuy: items });
    return { cutoff, setAside: total, created: !existing };
  },

  deleteCutoff: (id) =>
    set((s) => ({
      cutoffs: s.cutoffs.filter((c) => c.id !== id),
      toBuy: s.toBuy.map((item) => {
        const contributions = item.contributions.filter((c) => !(c.auto && c.cutoffId === id));
        if (contributions.length === item.contributions.length) return item;
        const updated = { ...item, contributions };
        return { ...updated, status: nextStatus(updated) };
      }),
    })),

  reapplyCutoff: (id) => {
    const s = get();
    const c = s.cutoffs.find((x) => x.id === id);
    if (!c) return;
    const ruleId = s.rules.some((r) => r.id === c.ruleId) ? c.ruleId : s.settings.activeRuleId;
    const next = buildCutoff(
      { cutoffId: c.id, gross: c.gross, govAlreadyDeducted: c.govAlreadyDeducted, ruleId, adjustments: c.adjustments, note: c.note },
      contextOf(s),
      new Date().toISOString(),
      c,
    );
    set({ cutoffs: s.cutoffs.map((x) => (x.id === id ? next : x)) });
  },
});
