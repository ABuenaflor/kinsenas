import { create } from "zustand";
import type { Expense, ToBuyItem } from "@/domain/types";

/** Transient, non-persisted UI state shared across the shell (drawers, palette). */
interface UiStore {
  expenseDrawer: { open: boolean; editing?: Expense; prefill?: Partial<Expense> };
  toBuyDrawer: { open: boolean; editing?: ToBuyItem };
  paletteOpen: boolean;
  saveSignal: number; // increments on cutoff save (Spline hero listens)
  openExpense: (opts?: { editing?: Expense; prefill?: Partial<Expense> }) => void;
  closeExpense: () => void;
  openToBuy: (editing?: ToBuyItem) => void;
  closeToBuy: () => void;
  setPalette: (open: boolean) => void;
  fireSave: () => void;
}

export const useUi = create<UiStore>((set) => ({
  expenseDrawer: { open: false },
  toBuyDrawer: { open: false },
  paletteOpen: false,
  saveSignal: 0,
  openExpense: (opts) => set({ expenseDrawer: { open: true, ...opts } }),
  closeExpense: () => set((s) => ({ expenseDrawer: { ...s.expenseDrawer, open: false } })),
  openToBuy: (editing) => set({ toBuyDrawer: { open: true, editing } }),
  closeToBuy: () => set((s) => ({ toBuyDrawer: { ...s.toBuyDrawer, open: false } })),
  setPalette: (open) => set({ paletteOpen: open }),
  fireSave: () => set((s) => ({ saveSignal: s.saveSignal + 1 })),
}));
