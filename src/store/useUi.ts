import { create } from "zustand";
import type { Expense, ToBuyItem } from "@/domain/types";

export type AddSource = "inline" | "drawer" | "palette";

/** Transient, non-persisted UI state shared across the shell (drawers, palette). */
interface UiStore {
  expenseDrawer: { open: boolean; editing?: Expense; prefill?: Partial<Expense> };
  toBuyDrawer: { open: boolean; editing?: ToBuyItem };
  paletteOpen: boolean;
  saveSignal: number; // increments on cutoff save (Spline hero listens)
  lastAdded: { id: string; from: AddSource } | null; // newest expense row flies in from its source
  markAdded: (id: string, from: AddSource) => void;
  openExpense: (opts?: { editing?: Expense; prefill?: Partial<Expense> }) => void;
  closeExpense: () => void;
  openToBuy: (editing?: ToBuyItem) => void;
  closeToBuy: () => void;
  setPalette: (open: boolean) => void;
  fireSave: () => void;
}

export const useUi = create<UiStore>((set, get) => ({
  expenseDrawer: { open: false },
  toBuyDrawer: { open: false },
  paletteOpen: false,
  saveSignal: 0,
  lastAdded: null,
  markAdded: (id, from) => {
    set({ lastAdded: { id, from } });
    // Forget it once the fly-in has played so revisiting the list doesn't replay it.
    setTimeout(() => get().lastAdded?.id === id && set({ lastAdded: null }), 2000);
  },
  openExpense: (opts) => set({ expenseDrawer: { open: true, ...opts } }),
  closeExpense: () => set((s) => ({ expenseDrawer: { ...s.expenseDrawer, open: false } })),
  openToBuy: (editing) => set({ toBuyDrawer: { open: true, editing } }),
  closeToBuy: () => set((s) => ({ toBuyDrawer: { ...s.toBuyDrawer, open: false } })),
  setPalette: (open) => set({ paletteOpen: open }),
  fireSave: () => set((s) => ({ saveSignal: s.saveSignal + 1 })),
}));
