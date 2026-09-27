import { z } from "zod";
import type { AppData } from "./types";
import { STORE_VERSION } from "./migrations";

const int = z.number().int();
const nonNeg = z.number().int().nonnegative();
const cutoffId = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-[AB]$/, "must look like 2026-09-A");
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD");

const settings = z.object({
  locale: z.literal("en-PH"),
  currency: z.literal("PHP"),
  paydays: z.object({ first: int.min(1).max(31), second: z.union([int.min(1).max(31), z.literal("last")]) }),
  monthlyBasicSalary: nonNeg.nullable(),
  activeRuleId: z.string(),
  theme: z.enum(["paper", "workbench", "system"]),
  motion: z.enum(["system", "reduced", "full"]),
  smoothScroll: z.boolean(),
  show3D: z.boolean(),
  onboardingDone: z.boolean(),
});

const govRates = z.object({
  label: z.string(),
  sss: z.object({ employeeRate: nonNeg, mscMin: nonNeg, mscMax: nonNeg, mscStep: int.positive() }),
  philhealth: z.object({ employeeRate: nonNeg, floor: nonNeg, ceiling: nonNeg }),
  pagibig: z.object({ lowRate: nonNeg, highRate: nonNeg, lowThreshold: nonNeg, maxFundSalary: nonNeg }),
  withholdingSemiMonthly: z.array(z.object({ over: nonNeg, base: nonNeg, rate: nonNeg })).min(1),
});

const govDeduction = z.object({
  id: z.enum(["sss", "philhealth", "pagibig", "tax"]),
  enabled: z.boolean(),
  mode: z.enum(["auto", "fixed"]),
  fixedAmount: nonNeg,
  schedule: z.enum(["split", "A", "B"]),
});

const customDeduction = z.object({
  id: z.string(),
  name: z.string(),
  emoji: z.string().optional(),
  kind: z.enum(["fixed", "percent"]),
  amount: nonNeg,
  percent: nonNeg,
  schedule: z.enum(["every", "A", "B"]),
  startCutoff: cutoffId.optional(),
  endCutoff: cutoffId.optional(),
  active: z.boolean(),
  order: int,
});

const bucket = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  icon: z.string().optional(),
  countsAsSavings: z.boolean(),
  archived: z.boolean(),
  order: int,
});

const rule = z.object({
  id: z.string(),
  name: z.string(),
  shares: z.array(z.object({ bucketId: z.string(), kind: z.enum(["percent", "fixed"]), percent: nonNeg, fixedAmount: nonNeg })),
});

const cutoff = z.object({
  id: cutoffId,
  year: int,
  month: int.min(1).max(12),
  half: z.enum(["A", "B"]),
  payDate: isoDate,
  gross: int,
  govAlreadyDeducted: z.boolean(),
  note: z.string().optional(),
  ruleId: z.string(),
  adjustments: z
    .object({
      overrides: z.record(z.string(), int),
      extras: z.array(z.object({ id: z.string(), label: z.string(), amount: int })),
    })
    .optional(),
  deductions: z.array(z.object({ key: z.string(), label: z.string(), source: z.enum(["gov", "custom"]), amount: int })),
  totalDeductions: int,
  net: int,
  allocations: z.array(
    z.object({ bucketId: z.string(), name: z.string(), color: z.string(), countsAsSavings: z.boolean(), amount: int }),
  ),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const category = z.object({
  id: z.string(),
  name: z.string(),
  emoji: z.string(),
  color: z.string(),
  defaultBucketId: z.string().optional(),
  archived: z.boolean(),
});

const expense = z.object({
  id: z.string(),
  amount: int,
  date: isoDate,
  categoryId: z.string(),
  bucketId: z.string(),
  cutoffId,
  note: z.string().optional(),
  toBuyItemId: z.string().optional(),
  createdAt: z.string(),
});

const toBuyItem = z.object({
  id: z.string(),
  name: z.string(),
  targetPrice: nonNeg,
  priority: z.enum(["low", "medium", "high"]),
  url: z.string().optional(),
  imageUrl: z.string().optional(),
  note: z.string().optional(),
  targetDate: isoDate.optional(),
  bucketId: z.string(),
  autoContribution: z.union([
    z.null(),
    z.object({ kind: z.literal("fixed"), amount: nonNeg }),
    z.object({ kind: z.literal("percentOfBucket"), percent: nonNeg }),
  ]),
  contributions: z.array(z.object({ id: z.string(), cutoffId, amount: int, date: isoDate, auto: z.boolean() })),
  status: z.enum(["saving", "ready", "bought", "archived"]),
  purchase: z.object({ expenseId: z.string(), actualPrice: nonNeg, date: isoDate }).optional(),
  order: int,
  createdAt: z.string(),
});

export const appDataSchema = z.object({
  settings,
  govRates,
  govDeductions: z.array(govDeduction),
  customDeductions: z.array(customDeduction),
  buckets: z.array(bucket),
  rules: z.array(rule),
  categories: z.array(category),
  cutoffs: z.array(cutoff),
  expenses: z.array(expense),
  toBuy: z.array(toBuyItem),
});

export const exportFileSchema = z.object({
  app: z.literal("kinsenas"),
  version: int,
  exportedAt: z.string(),
  data: appDataSchema,
});

export interface ExportFile {
  app: "kinsenas";
  version: number;
  exportedAt: string;
  data: AppData;
}

export function makeExport(data: AppData, nowIso: string): ExportFile {
  return { app: "kinsenas", version: STORE_VERSION, exportedAt: nowIso, data };
}

export type ParseResult = { ok: true; file: ExportFile } | { ok: false; error: string };

/** Validate an import file, reporting the first failing field path. */
export function parseImport(text: string): ParseResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: "This file isn't valid JSON." };
  }
  const r = exportFileSchema.safeParse(json);
  if (!r.success) {
    const issue = r.error.issues[0];
    const path = issue?.path.map(String).join(".") || "(root)";
    return { ok: false, error: `${path}: ${issue?.message ?? "invalid"}` };
  }
  if (r.data.version > STORE_VERSION) return { ok: false, error: `This file is from a newer version (v${r.data.version}).` };
  return { ok: true, file: r.data as ExportFile };
}
