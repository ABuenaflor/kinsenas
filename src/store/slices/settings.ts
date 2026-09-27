import { PH_2026 } from "@/domain/govRates";
import type {
  AllocationRule,
  Bucket,
  Category,
  CustomDeduction,
  GovDeduction,
  GovId,
  GovRates,
  Settings,
} from "@/domain/types";
import type { Get, Set } from "../useStore";

export type RemoveResult = { ok: true; archived: boolean } | { ok: false; reason: string };

export interface SettingsSlice {
  updateSettings: (patch: Partial<Settings>) => void;
  updateGovDeduction: (id: GovId, patch: Partial<GovDeduction>) => void;
  setGovRates: (rates: GovRates) => void;
  resetGovRates: () => void;
  upsertCustomDeduction: (d: CustomDeduction) => void;
  removeCustomDeduction: (id: string) => void;
  reorderCustomDeductions: (ids: string[]) => void;
  upsertBucket: (b: Bucket) => void;
  removeBucket: (id: string) => RemoveResult;
  restoreBucket: (id: string) => void;
  upsertRule: (r: AllocationRule) => void;
  removeRule: (id: string) => RemoveResult;
  setActiveRule: (id: string) => void;
  upsertCategory: (c: Category) => void;
  removeCategory: (id: string) => RemoveResult;
  restoreCategory: (id: string) => void;
}

function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  return list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item];
}

export const settingsSlice = (set: Set, get: Get): SettingsSlice => ({
  updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
  updateGovDeduction: (id, patch) =>
    set((s) => ({ govDeductions: s.govDeductions.map((g) => (g.id === id ? { ...g, ...patch } : g)) })),
  setGovRates: (rates) => set({ govRates: rates }),
  resetGovRates: () => set({ govRates: structuredClone(PH_2026) }),

  upsertCustomDeduction: (d) => set((s) => ({ customDeductions: upsert(s.customDeductions, d) })),
  removeCustomDeduction: (id) => set((s) => ({ customDeductions: s.customDeductions.filter((d) => d.id !== id) })),
  reorderCustomDeductions: (ids) =>
    set((s) => ({
      customDeductions: s.customDeductions.map((d) => ({ ...d, order: Math.max(0, ids.indexOf(d.id)) })),
    })),

  upsertBucket: (b) => set((s) => ({ buckets: upsert(s.buckets, b) })),
  removeBucket: (id) => {
    const s = get();
    const inRule = s.rules.find((r) => r.shares.some((sh) => sh.bucketId === id));
    if (inRule) return { ok: false, reason: `Remove it from the “${inRule.name}” rule first.` };
    const used =
      s.cutoffs.some((c) => c.allocations.some((a) => a.bucketId === id)) ||
      s.expenses.some((e) => e.bucketId === id) ||
      s.toBuy.some((t) => t.bucketId === id) ||
      s.categories.some((c) => c.defaultBucketId === id);
    if (used) {
      set({ buckets: s.buckets.map((b) => (b.id === id ? { ...b, archived: true } : b)) });
      return { ok: true, archived: true };
    }
    set({ buckets: s.buckets.filter((b) => b.id !== id) });
    return { ok: true, archived: false };
  },
  restoreBucket: (id) => set((s) => ({ buckets: s.buckets.map((b) => (b.id === id ? { ...b, archived: false } : b)) })),

  upsertRule: (r) => set((s) => ({ rules: upsert(s.rules, r) })),
  removeRule: (id) => {
    const s = get();
    if (s.settings.activeRuleId === id) return { ok: false, reason: "That's your active rule. Pick another one first." };
    if (s.rules.length <= 1) return { ok: false, reason: "Keep at least one rule." };
    set({ rules: s.rules.filter((r) => r.id !== id) });
    return { ok: true, archived: false };
  },
  setActiveRule: (id) => set((s) => ({ settings: { ...s.settings, activeRuleId: id } })),

  upsertCategory: (c) => set((s) => ({ categories: upsert(s.categories, c) })),
  removeCategory: (id) => {
    const s = get();
    if (s.expenses.some((e) => e.categoryId === id)) {
      set({ categories: s.categories.map((c) => (c.id === id ? { ...c, archived: true } : c)) });
      return { ok: true, archived: true };
    }
    set({ categories: s.categories.filter((c) => c.id !== id) });
    return { ok: true, archived: false };
  },
  restoreCategory: (id) =>
    set((s) => ({ categories: s.categories.map((c) => (c.id === id ? { ...c, archived: false } : c)) })),
});
