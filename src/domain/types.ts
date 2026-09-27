export type Centavos = number; // integer, ₱1.00 = 100
export type Bps = number; // integer, 50% = 5000
export type Half = "A" | "B"; // A = first payday (default 15th), B = second payday (default last day)
export type CutoffId = string; // "2026-09-A" | "2026-09-B"
export type ISODate = string; // "2026-09-15"

export interface Paydays {
  first: number;
  second: number | "last";
}

export interface Settings {
  locale: "en-PH";
  currency: "PHP";
  paydays: Paydays; // default { first: 15, second: "last" }; first < second
  monthlyBasicSalary: Centavos | null; // basis for SSS/PhilHealth/Pag-IBIG; null → cutoff gross × 2
  activeRuleId: string;
  theme: "paper" | "workbench" | "system";
  motion: "system" | "reduced" | "full";
  smoothScroll: boolean;
  show3D: boolean;
  onboardingDone: boolean;
}

export type GovId = "sss" | "philhealth" | "pagibig" | "tax";
export interface GovDeduction {
  id: GovId;
  enabled: boolean;
  mode: "auto" | "fixed";
  fixedAmount: Centavos; // per applicable cutoff when mode = "fixed"
  schedule: "split" | "A" | "B"; // ignored for tax (always per cutoff)
}

export interface TaxBracket {
  over: Centavos;
  base: Centavos;
  rate: Bps;
}
export interface GovRates {
  label: string;
  sss: { employeeRate: Bps; mscMin: Centavos; mscMax: Centavos; mscStep: Centavos };
  philhealth: { employeeRate: Bps; floor: Centavos; ceiling: Centavos };
  pagibig: { lowRate: Bps; highRate: Bps; lowThreshold: Centavos; maxFundSalary: Centavos };
  withholdingSemiMonthly: TaxBracket[]; // ascending by `over`
}

export interface CustomDeduction {
  id: string;
  name: string;
  emoji?: string;
  kind: "fixed" | "percent";
  amount: Centavos;
  percent: Bps;
  schedule: "every" | "A" | "B";
  startCutoff?: CutoffId;
  endCutoff?: CutoffId;
  active: boolean;
  order: number;
}

export interface Bucket {
  id: string;
  name: string;
  color: string; // CSS color or var(--token)
  icon?: string;
  countsAsSavings: boolean;
  archived: boolean;
  order: number;
}
export interface RuleShare {
  bucketId: string;
  kind: "percent" | "fixed";
  percent: Bps;
  fixedAmount: Centavos;
}
export interface AllocationRule {
  id: string;
  name: string;
  shares: RuleShare[];
}

export interface DeductionLine {
  key: string;
  label: string;
  source: "gov" | "custom";
  amount: Centavos;
}
export interface AllocationLine {
  bucketId: string;
  name: string;
  color: string;
  countsAsSavings: boolean;
  amount: Centavos;
}

/** One-time tweaks for a single cutoff (Payday → "Adjust this cutoff"). */
export interface CutoffAdjustments {
  overrides: Record<string, Centavos>; // DeductionLine.key → amount
  extras: { id: string; label: string; amount: Centavos }[];
}

export interface Cutoff {
  id: CutoffId;
  year: number;
  month: number; // 1-12
  half: Half;
  payDate: ISODate;
  gross: Centavos;
  govAlreadyDeducted: boolean;
  note?: string;
  ruleId: string;
  adjustments?: CutoffAdjustments;
  // Snapshots taken at save time. Changing settings later never silently rewrites history.
  deductions: DeductionLine[];
  totalDeductions: Centavos;
  net: Centavos;
  allocations: AllocationLine[];
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  emoji: string;
  color: string;
  defaultBucketId?: string;
  archived: boolean;
}

export interface Expense {
  id: string;
  amount: Centavos;
  date: ISODate;
  categoryId: string;
  bucketId: string;
  cutoffId: CutoffId; // auto-derived from date, user-overridable
  note?: string;
  toBuyItemId?: string;
  createdAt: string;
}

export interface Contribution {
  id: string;
  cutoffId: CutoffId;
  amount: Centavos; // < 0 = withdrawal
  date: ISODate;
  auto: boolean;
}

export type AutoContribution =
  | null
  | { kind: "fixed"; amount: Centavos }
  | { kind: "percentOfBucket"; percent: Bps };

export interface ToBuyItem {
  id: string;
  name: string;
  targetPrice: Centavos;
  priority: "low" | "medium" | "high";
  url?: string;
  imageUrl?: string;
  note?: string;
  targetDate?: ISODate;
  bucketId: string; // which bucket funds it (default: Wants)
  autoContribution: AutoContribution;
  contributions: Contribution[];
  status: "saving" | "ready" | "bought" | "archived"; // "ready" = funded ≥ target
  purchase?: { expenseId: string; actualPrice: Centavos; date: ISODate };
  order: number;
  createdAt: string;
}
