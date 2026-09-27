import { buildCutoff } from "@/domain/computeCutoff";
import { nextStatus } from "@/domain/toBuy";
import type { Contribution, CustomDeduction, Cutoff, Expense, ISODate, Paydays, ToBuyItem } from "@/domain/types";
import { mulberry32, pick, randInt } from "@/lib/rng";
import {
  lastDay,
  makeCutoffId,
  parseISODate,
  payDateOf,
  periodOf,
  shiftMonthKey,
  toISODate,
} from "@/lib/periods";
import { defaultData, TO_BUY_CATEGORY_ID } from "@/store/defaults";
import type { AppData } from "@/store/types";

const P = (pesos: number) => Math.round(pesos * 100);

// [categoryId, weight, minPesos, maxPesos, notes]
const SPEND: [string, number, number, number, string[]][] = [
  ["cat-food", 22, 40, 150, ["Lunch", "Merienda", "Breakfast", "Kape"]],
  ["cat-transport", 18, 15, 100, ["Jeep", "Grab", "MRT", "Tricycle", "Angkas"]],
  ["cat-eating-out", 6, 100, 300, ["Samgyup", "Jollibee", "Ramen night", "Coffee shop"]],
  ["cat-groceries", 5, 200, 650, ["Palengke", "Grocery run", "Puregold"]],
  ["cat-load", 4, 99, 399, ["Load", "Fiber bill"]],
  ["cat-bills", 2, 300, 900, ["Meralco", "Water", "Phone plan"]],
  ["cat-shopping", 3, 120, 450, ["Shopee", "Lazada", "Uniqlo"]],
  ["cat-leisure", 3, 80, 300, ["Movie", "Steam sale", "Badminton court"]],
  ["cat-health", 3, 60, 400, ["Vitamins", "Checkup", "Pharmacy"]],
  ["cat-family", 2, 300, 800, ["Padala kay Mama", "Pasalubong"]],
  ["cat-others", 2, 50, 300, ["Laundry", "Gift wrap"]],
];

/** 6 months of realistic, deterministic demo data ending at `today`. */
export function generateDemoData(today: ISODate, paydays: Paydays): AppData {
  const rng = mulberry32(20260915);
  const base = defaultData();
  const customDeductions: CustomDeduction[] = [
    { id: "demo-loan", name: "SSS salary loan", emoji: "🏦", kind: "fixed", amount: P(500), percent: 0, schedule: "every", active: true, order: 0 },
    { id: "demo-hmo", name: "HMO dependent", emoji: "🩺", kind: "fixed", amount: P(250), percent: 0, schedule: "A", active: true, order: 1 },
  ];
  const data: AppData = {
    ...base,
    settings: { ...base.settings, monthlyBasicSalary: P(33000), onboardingDone: true, paydays },
    customDeductions,
  };

  const { year, month } = parseISODate(today);
  const thisMonth = `${year}-${String(month).padStart(2, "0")}`;
  const months = Array.from({ length: 6 }, (_, i) => shiftMonthKey(thisMonth, i - 5));
  const ctx = { ...data };

  const cutoffs: Cutoff[] = [];
  for (const key of months) {
    const [y = year, m = month] = key.split("-").map(Number);
    for (const half of ["A", "B"] as const) {
      const id = makeCutoffId(y, m, half);
      if (payDateOf(id, paydays) > today) continue;
      const gross = P(randInt(rng, 150, 180) * 100);
      cutoffs.push(buildCutoff({ cutoffId: id, gross, govAlreadyDeducted: false, ruleId: data.settings.activeRuleId }, ctx, `${payDateOf(id, paydays)}T09:00:00.000Z`));
    }
  }

  const totalWeight = SPEND.reduce((s, x) => s + x[1], 0);
  const pickSpend = () => {
    let r = rng() * totalWeight;
    for (const row of SPEND) {
      r -= row[1];
      if (r <= 0) return row;
    }
    return SPEND[0]!;
  };
  const bucketOf = (categoryId: string) => data.categories.find((c) => c.id === categoryId)?.defaultBucketId ?? "wants";

  const expenses: Expense[] = [];
  let n = 0;
  const addExpense = (date: ISODate, categoryId: string, pesos: number, note: string, bucketId = bucketOf(categoryId)) => {
    expenses.push({
      id: `demo-exp-${n++}`,
      amount: P(pesos),
      date,
      categoryId,
      bucketId,
      cutoffId: periodOf(date, paydays),
      note,
      createdAt: `${date}T12:00:00.000Z`,
    });
  };
  for (const key of months) {
    const [y = year, m = month] = key.split("-").map(Number);
    const maxDay = key === thisMonth ? parseISODate(today).day : lastDay(y, m);
    const count = Math.round((randInt(rng, 40, 58) * maxDay) / lastDay(y, m));
    addExpense(toISODate(y, m, Math.min(5, maxDay)), "cat-rent", 2500, "Bedspace rent");
    for (let i = 0; i < count; i++) {
      const [cat, , min, max, notes] = pickSpend();
      addExpense(toISODate(y, m, randInt(rng, 1, maxDay)), cat, randInt(rng, min, max), pick(rng, notes));
    }
    if (rng() < 0.35) addExpense(toISODate(y, m, randInt(rng, 1, maxDay)), "cat-health", randInt(rng, 5, 15) * 100, "Emergency (from savings)", "savings");
  }

  const contrib = (id: string, cutoffId: string, pesos: number, auto = true): Contribution => ({
    id,
    cutoffId,
    amount: P(pesos),
    date: payDateOf(cutoffId, paydays),
    auto,
  });
  const recent = cutoffs.map((c) => c.id).slice(-8);
  const item = (partial: Omit<ToBuyItem, "status" | "createdAt">): ToBuyItem => {
    const withBase: ToBuyItem = { ...partial, status: "saving", createdAt: `${months[0]}-20T10:00:00.000Z` };
    return { ...withBase, status: nextStatus(withBase) };
  };
  const toBuy: ToBuyItem[] = [
    item({
      id: "demo-headphones",
      name: "Noise-cancelling headphones",
      targetPrice: P(8500),
      priority: "high",
      bucketId: "wants",
      note: "For the WFH days",
      autoContribution: { kind: "fixed", amount: P(1000) },
      contributions: recent.map((id, i) => contrib(`demo-c-h${i}`, id, i === 0 ? 1500 : 1000)),
      order: 0,
    }),
    item({
      id: "demo-bike",
      name: "Folding bike",
      targetPrice: P(18000),
      priority: "medium",
      bucketId: "wants",
      autoContribution: { kind: "percentOfBucket", percent: 2500 },
      contributions: recent.slice(-5).map((id, i) => contrib(`demo-c-b${i}`, id, 650 + i * 40)),
      order: 1,
    }),
    item({
      id: "demo-launion",
      name: "Weekend in La Union",
      targetPrice: P(12000),
      priority: "low",
      bucketId: "wants",
      targetDate: `${shiftMonthKey(thisMonth, 3)}-20`,
      autoContribution: null,
      contributions: recent.slice(-2).map((id, i) => contrib(`demo-c-l${i}`, id, 900, false)),
      order: 2,
    }),
  ];

  // One already-bought item with its purchase expense.
  const boughtCutoff = recent[1] ?? recent[0];
  if (boughtCutoff) {
    const date = payDateOf(boughtCutoff, paydays);
    const expenseId = "demo-exp-ricecooker";
    expenses.push({
      id: expenseId,
      amount: P(2890),
      date,
      categoryId: TO_BUY_CATEGORY_ID,
      bucketId: "essentials",
      cutoffId: periodOf(date, paydays),
      note: "Rice cooker",
      toBuyItemId: "demo-ricecooker",
      createdAt: `${date}T15:00:00.000Z`,
    });
    toBuy.push({
      id: "demo-ricecooker",
      name: "Rice cooker",
      targetPrice: P(3200),
      priority: "medium",
      bucketId: "essentials",
      autoContribution: null,
      contributions: recent.slice(0, 2).map((id, i) => contrib(`demo-c-r${i}`, id, 1600, false)),
      status: "bought",
      purchase: { expenseId, actualPrice: P(2890), date },
      order: 3,
      createdAt: `${months[0]}-10T10:00:00.000Z`,
    });
  }

  return {
    ...data,
    cutoffs,
    expenses: expenses.filter((e) => e.date <= today).sort((a, b) => a.date.localeCompare(b.date)),
    toBuy,
  };
}
