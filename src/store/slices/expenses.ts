import { nextStatus } from "@/domain/toBuy";
import type { Expense } from "@/domain/types";
import { newId } from "@/lib/ids";
import { periodOf } from "@/lib/periods";
import type { Get, Set } from "../useStore";

export type ExpenseDraft = Omit<Expense, "id" | "createdAt" | "cutoffId"> & { cutoffId?: string };

export interface ExpensesSlice {
  addExpense: (draft: ExpenseDraft) => Expense;
  updateExpense: (id: string, patch: Partial<Omit<Expense, "id" | "createdAt">>) => void;
  removeExpense: (id: string) => void;
}

export const expensesSlice = (set: Set, get: Get): ExpensesSlice => ({
  addExpense: (draft) => {
    const expense: Expense = {
      ...draft,
      id: newId(),
      cutoffId: draft.cutoffId ?? periodOf(draft.date, get().settings.paydays),
      note: draft.note?.trim() || undefined,
      createdAt: new Date().toISOString(),
    };
    set((s) => ({ expenses: [...s.expenses, expense] }));
    return expense;
  },
  updateExpense: (id, patch) =>
    set((s) => ({ expenses: s.expenses.map((e) => (e.id === id ? { ...e, ...patch } : e)) })),
  removeExpense: (id) =>
    set((s) => {
      const expense = s.expenses.find((e) => e.id === id);
      // Deleting a To-Buy purchase puts the item back on the list.
      const toBuy = expense?.toBuyItemId
        ? s.toBuy.map((t) => {
            if (t.id !== expense.toBuyItemId || t.purchase?.expenseId !== id) return t;
            const reverted = { ...t, status: "saving" as const, purchase: undefined };
            return { ...reverted, status: nextStatus(reverted) };
          })
        : s.toBuy;
      return { expenses: s.expenses.filter((e) => e.id !== id), toBuy };
    }),
});
