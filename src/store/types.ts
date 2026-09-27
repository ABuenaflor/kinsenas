import type {
  AllocationRule,
  Bucket,
  Category,
  CustomDeduction,
  Cutoff,
  Expense,
  GovDeduction,
  GovRates,
  Settings,
  ToBuyItem,
} from "@/domain/types";

/** Everything that is persisted / exported. */
export interface AppData {
  settings: Settings;
  govRates: GovRates;
  govDeductions: GovDeduction[];
  customDeductions: CustomDeduction[];
  buckets: Bucket[];
  rules: AllocationRule[];
  categories: Category[];
  cutoffs: Cutoff[];
  expenses: Expense[];
  toBuy: ToBuyItem[];
}

export const DATA_KEYS = [
  "settings",
  "govRates",
  "govDeductions",
  "customDeductions",
  "buckets",
  "rules",
  "categories",
  "cutoffs",
  "expenses",
  "toBuy",
] as const satisfies readonly (keyof AppData)[];
