import { nextStatus } from "@/domain/toBuy";
import type { Centavos, Contribution, CutoffId, Expense, ISODate, ToBuyItem } from "@/domain/types";
import { newId } from "@/lib/ids";
import { periodOf } from "@/lib/periods";
import { DEFAULT_CATEGORIES, TO_BUY_CATEGORY_ID } from "../defaults";
import type { Get, Set } from "../useStore";

export type ToBuyDraft = Omit<ToBuyItem, "id" | "contributions" | "status" | "order" | "createdAt" | "purchase">;

export interface ToBuySlice {
  addItem: (draft: ToBuyDraft) => ToBuyItem;
  updateItem: (id: string, patch: Partial<ToBuyDraft>) => void;
  addContribution: (itemId: string, c: { amount: Centavos; cutoffId: CutoffId; date: ISODate }) => void;
  removeContribution: (itemId: string, contributionId: string) => void;
  markBought: (itemId: string, actualPrice: Centavos, date: ISODate) => Expense | null;
  setArchived: (itemId: string, archived: boolean) => void;
  removeItem: (itemId: string) => void;
  reorderItems: (ids: string[]) => void;
}

function withStatus(item: ToBuyItem): ToBuyItem {
  return { ...item, status: nextStatus(item) };
}

export const toBuySlice = (set: Set, get: Get): ToBuySlice => ({
  addItem: (draft) => {
    const s = get();
    const item: ToBuyItem = {
      ...draft,
      id: newId(),
      contributions: [],
      status: "saving",
      order: s.toBuy.reduce((m, t) => Math.max(m, t.order + 1), 0),
      createdAt: new Date().toISOString(),
    };
    set({ toBuy: [...s.toBuy, item] });
    return item;
  },
  updateItem: (id, patch) =>
    set((s) => ({ toBuy: s.toBuy.map((t) => (t.id === id ? withStatus({ ...t, ...patch }) : t)) })),
  addContribution: (itemId, c) =>
    set((s) => ({
      toBuy: s.toBuy.map((t) => {
        if (t.id !== itemId) return t;
        const contribution: Contribution = { id: newId(), auto: false, ...c };
        return withStatus({ ...t, contributions: [...t.contributions, contribution] });
      }),
    })),
  removeContribution: (itemId, contributionId) =>
    set((s) => ({
      toBuy: s.toBuy.map((t) =>
        t.id === itemId ? withStatus({ ...t, contributions: t.contributions.filter((c) => c.id !== contributionId) }) : t,
      ),
    })),
  markBought: (itemId, actualPrice, date) => {
    const s = get();
    const item = s.toBuy.find((t) => t.id === itemId);
    if (!item) return null;
    const categories = s.categories.some((c) => c.id === TO_BUY_CATEGORY_ID)
      ? s.categories
      : [...s.categories, ...DEFAULT_CATEGORIES.filter((c) => c.id === TO_BUY_CATEGORY_ID)];
    const expense: Expense = {
      id: newId(),
      amount: actualPrice,
      date,
      categoryId: TO_BUY_CATEGORY_ID,
      bucketId: item.bucketId,
      cutoffId: periodOf(date, s.settings.paydays),
      note: item.name,
      toBuyItemId: item.id,
      createdAt: new Date().toISOString(),
    };
    set({
      categories,
      expenses: [...s.expenses, expense],
      toBuy: s.toBuy.map((t) =>
        t.id === itemId ? { ...t, status: "bought", purchase: { expenseId: expense.id, actualPrice, date } } : t,
      ),
    });
    return expense;
  },
  setArchived: (itemId, archived) =>
    set((s) => ({
      toBuy: s.toBuy.map((t) => {
        if (t.id !== itemId) return t;
        if (archived) return { ...t, status: "archived" };
        return withStatus({ ...t, status: t.purchase ? "bought" : "saving" });
      }),
    })),
  removeItem: (itemId) => set((s) => ({ toBuy: s.toBuy.filter((t) => t.id !== itemId) })),
  reorderItems: (ids) =>
    set((s) => ({
      toBuy: s.toBuy.map((t) => {
        const i = ids.indexOf(t.id);
        return i === -1 ? t : { ...t, order: i };
      }),
    })),
});
