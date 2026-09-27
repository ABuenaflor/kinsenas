import { presetShares } from "@/domain/allocation";
import { DEFAULT_GOV_DEDUCTIONS, PH_2026 } from "@/domain/govRates";
import type { AllocationRule, Bucket, Category, Settings } from "@/domain/types";
import type { AppData } from "./types";

export const SWATCHES = [
  "var(--swatch-1)",
  "var(--swatch-2)",
  "var(--swatch-3)",
  "var(--swatch-4)",
  "var(--swatch-5)",
  "var(--swatch-6)",
  "var(--swatch-7)",
  "var(--swatch-8)",
] as const;

export const BUCKET_COLORS = ["var(--savings)", "var(--essentials)", "var(--wants)", ...SWATCHES] as const;

export const DEFAULT_BUCKETS: Bucket[] = [
  { id: "savings", name: "Savings", color: "var(--savings)", icon: "PiggyBank", countsAsSavings: true, archived: false, order: 0 },
  { id: "essentials", name: "Essentials", color: "var(--essentials)", icon: "House", countsAsSavings: false, archived: false, order: 1 },
  { id: "wants", name: "Wants", color: "var(--wants)", icon: "Sparkles", countsAsSavings: false, archived: false, order: 2 },
];

export const DEFAULT_RULE_ID = "rule-50-30-20";
export const DEFAULT_RULES: AllocationRule[] = [
  { id: DEFAULT_RULE_ID, name: "50 / 30 / 20", shares: presetShares(["savings", "essentials", "wants"], [5000, 3000, 2000]) },
];

export const TO_BUY_CATEGORY_ID = "cat-to-buy";

const cat = (id: string, emoji: string, name: string, color: string, defaultBucketId: string): Category => ({
  id: `cat-${id}`,
  name,
  emoji,
  color,
  defaultBucketId,
  archived: false,
});

export const DEFAULT_CATEGORIES: Category[] = [
  cat("food", "🍚", "Food", "var(--swatch-1)", "essentials"),
  cat("transport", "🚌", "Transport", "var(--swatch-2)", "essentials"),
  cat("bills", "⚡", "Bills", "var(--swatch-3)", "essentials"),
  cat("rent", "🏠", "Rent", "var(--swatch-4)", "essentials"),
  cat("groceries", "🛒", "Groceries", "var(--swatch-5)", "essentials"),
  cat("load", "📶", "Load/Internet", "var(--swatch-6)", "essentials"),
  cat("health", "💊", "Health", "var(--swatch-7)", "essentials"),
  cat("family", "👨‍👩‍👧", "Family", "var(--swatch-8)", "essentials"),
  cat("shopping", "🛍️", "Shopping", "var(--swatch-1)", "wants"),
  cat("leisure", "🎮", "Leisure", "var(--swatch-2)", "wants"),
  cat("eating-out", "🍜", "Eating out", "var(--swatch-3)", "wants"),
  cat("others", "📦", "Others", "var(--swatch-4)", "wants"),
  cat("to-buy", "🎁", "To-Buy", "var(--swatch-5)", "wants"),
];

export const DEFAULT_SETTINGS: Settings = {
  locale: "en-PH",
  currency: "PHP",
  paydays: { first: 15, second: "last" },
  monthlyBasicSalary: null,
  activeRuleId: DEFAULT_RULE_ID,
  theme: "paper",
  motion: "system",
  smoothScroll: false,
  show3D: true,
  onboardingDone: false,
};

export function defaultData(): AppData {
  return structuredClone({
    settings: DEFAULT_SETTINGS,
    govRates: PH_2026,
    govDeductions: DEFAULT_GOV_DEDUCTIONS,
    customDeductions: [],
    buckets: DEFAULT_BUCKETS,
    rules: DEFAULT_RULES,
    categories: DEFAULT_CATEGORIES,
    cutoffs: [],
    expenses: [],
    toBuy: [],
  });
}
