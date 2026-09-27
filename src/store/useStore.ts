import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { CutoffId } from "@/domain/types";
import { defaultCutoffToLog, periodOf, todayISO } from "@/lib/periods";
import { generateDemoData } from "@/dev/demoData";
import { defaultData } from "./defaults";
import { migrate, STORE_KEY, STORE_VERSION } from "./migrations";
import { expensesSlice, type ExpensesSlice } from "./slices/expenses";
import { paydaySlice, type PaydaySlice } from "./slices/payday";
import { settingsSlice, type SettingsSlice } from "./slices/settings";
import { toBuySlice, type ToBuySlice } from "./slices/toBuy";
import { safeStorage, storageAvailable } from "./storage";
import { DATA_KEYS, type AppData } from "./types";

export interface UiState {
  period: CutoffId;
  storageOk: boolean;
}

interface CoreSlice {
  ui: UiState;
  setPeriod: (id: CutoffId) => void;
  /** Deep copy of all persisted data (used for Undo). */
  snapshot: () => AppData;
  restore: (data: AppData) => void;
  replaceData: (data: AppData) => void;
  /** Union by id; with includeSettings also adopt the backup's paydays, salary, rates and gov settings (keeps your theme/motion). */
  mergeData: (data: AppData, opts?: { includeSettings?: boolean }) => void;
  resetAll: () => void;
  loadDemo: () => void;
}

export type Store = AppData & CoreSlice & SettingsSlice & PaydaySlice & ExpensesSlice & ToBuySlice;
export type Set = (partial: Partial<Store> | ((s: Store) => Partial<Store>)) => void;
export type Get = () => Store;

export function pickData(s: AppData): AppData {
  const out = {} as Record<string, unknown>;
  for (const k of DATA_KEYS) out[k] = s[k];
  return structuredClone(out) as unknown as AppData;
}

function mergeById<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  const map = new Map(current.map((x) => [x.id, x]));
  for (const x of incoming) map.set(x.id, x);
  return [...map.values()];
}

const initialPeriod = () => periodOf(todayISO(), defaultData().settings.paydays);

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      ...defaultData(),
      ui: { period: initialPeriod(), storageOk: storageAvailable },
      setPeriod: (id) => set((s) => ({ ui: { ...s.ui, period: id } })),
      snapshot: () => pickData(get()),
      restore: (data) => set(structuredClone(data)),
      replaceData: (data) => set(structuredClone(data)),
      mergeData: (data, opts) =>
        set((s) => ({
          ...(opts?.includeSettings
            ? {
                settings: { ...data.settings, theme: s.settings.theme, motion: s.settings.motion, smoothScroll: s.settings.smoothScroll, show3D: s.settings.show3D, onboardingDone: true },
                govRates: data.govRates,
                govDeductions: data.govDeductions,
              }
            : {}),
          customDeductions: mergeById(s.customDeductions, data.customDeductions),
          buckets: mergeById(s.buckets, data.buckets),
          rules: mergeById(s.rules, data.rules),
          categories: mergeById(s.categories, data.categories),
          cutoffs: mergeById(s.cutoffs, data.cutoffs),
          expenses: mergeById(s.expenses, data.expenses),
          toBuy: mergeById(s.toBuy, data.toBuy),
        })),
      resetAll: () => set({ ...defaultData(), ui: { ...get().ui, period: initialPeriod() } }),
      loadDemo: () => {
        const s = get();
        const demo = generateDemoData(todayISO(), s.settings.paydays);
        set({
          ...demo,
          settings: { ...s.settings, ...demo.settings, theme: s.settings.theme, motion: s.settings.motion, onboardingDone: true },
        });
      },
      ...settingsSlice(set, get),
      ...paydaySlice(set, get),
      ...expensesSlice(set, get),
      ...toBuySlice(set, get),
    }),
    {
      name: STORE_KEY,
      version: STORE_VERSION,
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => {
        const out = {} as Record<string, unknown>;
        for (const k of DATA_KEYS) out[k] = s[k];
        return out as unknown as AppData;
      },
      migrate: (persisted, version) => migrate(persisted, version),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AppData>;
        const merged = { ...current, ...p } as Store;
        // Settings may gain new keys over time; keep defaults for anything missing.
        merged.settings = { ...current.settings, ...(p.settings ?? {}) };
        merged.ui = {
          ...current.ui,
          period: defaultCutoffToLog(todayISO(), merged.settings.paydays, new Set((merged.cutoffs ?? []).map((c) => c.id))),
        };
        return merged;
      },
    },
  ),
);
