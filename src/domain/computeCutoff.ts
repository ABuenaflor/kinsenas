import { sum } from "@/lib/money";
import { payDateOf, parseCutoffId } from "@/lib/periods";
import { allocate } from "./allocation";
import { contributionForCutoff, type ContribId } from "./contributions";
import { customDeductionLines } from "./deductions";
import { GOV_LABELS } from "./govRates";
import { withholdingTax } from "./tax";
import type {
  AllocationLine,
  AllocationRule,
  Bucket,
  Centavos,
  CustomDeduction,
  Cutoff,
  CutoffAdjustments,
  CutoffBasis,
  CutoffId,
  DeductionLine,
  GovDeduction,
  GovRates,
  Settings,
} from "./types";

export interface CutoffInput {
  cutoffId: CutoffId;
  gross: Centavos;
  govAlreadyDeducted: boolean;
  ruleId: string;
  adjustments?: CutoffAdjustments;
}

export interface CutoffContext {
  settings: Pick<Settings, "paydays" | "monthlyBasicSalary">;
  govRates: GovRates;
  govDeductions: readonly GovDeduction[];
  customDeductions: readonly CustomDeduction[];
  buckets: readonly Bucket[];
  rules: readonly AllocationRule[];
}

export interface CutoffResult {
  deductions: DeductionLine[];
  totalDeductions: Centavos;
  net: Centavos;
  allocations: AllocationLine[];
  taxable: Centavos;
  monthlyBasis: Centavos;
  negativeNet: boolean;
  rule: AllocationRule | undefined;
}

const CONTRIB_IDS: ContribId[] = ["sss", "philhealth", "pagibig"];

/** gross → deduction lines → net → allocations. The single entry point for cutoff math. */
export function computeCutoff(input: CutoffInput, ctx: CutoffContext): CutoffResult {
  const { half } = parseCutoffId(input.cutoffId);
  const overrides = input.adjustments?.overrides ?? {};
  const monthlyBasis = ctx.settings.monthlyBasicSalary ?? input.gross * 2;
  const override = (key: string, amount: Centavos) => (key in overrides ? (overrides[key] ?? amount) : amount);

  const gov: DeductionLine[] = [];
  if (!input.govAlreadyDeducted) {
    for (const id of CONTRIB_IDS) {
      const config = ctx.govDeductions.find((g) => g.id === id);
      if (!config?.enabled) continue;
      const amount = override(`gov:${id}`, contributionForCutoff(config, monthlyBasis, half, ctx.govRates));
      gov.push({ key: `gov:${id}`, label: GOV_LABELS[id], source: "gov", amount });
    }
  }

  const taxable = Math.max(0, input.gross - sum(gov.map((l) => l.amount)));
  const taxConfig = ctx.govDeductions.find((g) => g.id === "tax");
  if (!input.govAlreadyDeducted && taxConfig?.enabled) {
    const auto = taxConfig.mode === "fixed" ? taxConfig.fixedAmount : withholdingTax(taxable, ctx.govRates.withholdingSemiMonthly);
    gov.push({ key: "gov:tax", label: GOV_LABELS.tax, source: "gov", amount: override("gov:tax", auto) });
  }

  const custom = customDeductionLines(ctx.customDeductions, input.cutoffId, input.gross).map((l) => ({
    ...l,
    amount: override(l.key, l.amount),
  }));
  const extras: DeductionLine[] = (input.adjustments?.extras ?? []).map((e) => ({
    key: `adj:${e.id}`,
    label: e.label || "One-time deduction",
    source: "custom",
    amount: e.amount,
  }));

  const deductions = [...gov, ...custom, ...extras];
  const totalDeductions = sum(deductions.map((l) => l.amount));
  const net = input.gross - totalDeductions;
  const rule = ctx.rules.find((r) => r.id === input.ruleId) ?? ctx.rules[0];
  const allocations = rule ? allocate(Math.max(0, net), rule, ctx.buckets) : [];

  return { deductions, totalDeductions, net, allocations, taxable, monthlyBasis, negativeNet: net < 0, rule };
}

/** Capture what a cutoff is being computed with (stored as Cutoff.basis). */
export function basisOf(cutoffId: CutoffId, gross: Centavos, ctx: CutoffContext, rule: AllocationRule): CutoffBasis {
  const bucketIds = new Set(rule.shares.map((s) => s.bucketId));
  return structuredClone({
    monthlyBasicSalary: ctx.settings.monthlyBasicSalary,
    govRates: ctx.govRates,
    govDeductions: [...ctx.govDeductions],
    customDeductions: ctx.customDeductions.filter((d) => customDeductionLines([d], cutoffId, gross).length > 0),
    rule,
    buckets: ctx.buckets.filter((b) => bucketIds.has(b.id)),
  });
}

/**
 * Context for editing a saved cutoff: its stored basis, not today's settings.
 * Picking a different rule while editing uses that rule's current definition.
 * Cutoffs saved before bases existed fall back to the current context.
 */
export function editContext(basis: CutoffBasis | undefined, current: CutoffContext, ruleId: string): CutoffContext {
  if (!basis) return current;
  const sameRule = ruleId === basis.rule.id;
  const snapBucketIds = new Set(basis.buckets.map((b) => b.id));
  return {
    settings: { paydays: current.settings.paydays, monthlyBasicSalary: basis.monthlyBasicSalary },
    govRates: basis.govRates,
    govDeductions: basis.govDeductions,
    customDeductions: basis.customDeductions,
    buckets: sameRule ? [...basis.buckets, ...current.buckets.filter((b) => !snapBucketIds.has(b.id))] : current.buckets,
    rules: sameRule ? [basis.rule, ...current.rules.filter((r) => r.id !== basis.rule.id)] : current.rules,
  };
}

/** Build a Cutoff record (snapshot) from an input + context. */
export function buildCutoff(
  input: CutoffInput & { note?: string },
  ctx: CutoffContext,
  nowIso: string,
  existing?: Cutoff,
): Cutoff {
  const r = computeCutoff(input, ctx);
  const { year, month, half } = parseCutoffId(input.cutoffId);
  return {
    id: input.cutoffId,
    year,
    month,
    half,
    payDate: existing?.payDate ?? payDateOf(input.cutoffId, ctx.settings.paydays),
    gross: input.gross,
    govAlreadyDeducted: input.govAlreadyDeducted,
    note: input.note?.trim() || undefined,
    ruleId: r.rule?.id ?? input.ruleId,
    adjustments: input.adjustments,
    basis: r.rule ? basisOf(input.cutoffId, input.gross, ctx, r.rule) : undefined,
    deductions: r.deductions,
    totalDeductions: r.totalDeductions,
    net: r.net,
    allocations: r.allocations,
    createdAt: existing?.createdAt ?? nowIso,
    updatedAt: nowIso,
  };
}

export interface LineDiff {
  label: string;
  before: Centavos;
  after: Centavos;
}

/** Differences between a stored snapshot and a recomputation (for "Re-apply current rules"). */
export function diffCutoff(before: Cutoff, after: Pick<Cutoff, "deductions" | "net" | "allocations">): LineDiff[] {
  const out: LineDiff[] = [];
  const keys = new Set([...before.deductions.map((d) => d.key), ...after.deductions.map((d) => d.key)]);
  for (const key of keys) {
    const b = before.deductions.find((d) => d.key === key);
    const a = after.deductions.find((d) => d.key === key);
    if ((b?.amount ?? 0) !== (a?.amount ?? 0)) out.push({ label: a?.label ?? b?.label ?? key, before: b?.amount ?? 0, after: a?.amount ?? 0 });
  }
  if (before.net !== after.net) out.push({ label: "Net", before: before.net, after: after.net });
  const buckets = new Set([...before.allocations.map((x) => x.bucketId), ...after.allocations.map((x) => x.bucketId)]);
  for (const id of buckets) {
    const b = before.allocations.find((x) => x.bucketId === id);
    const a = after.allocations.find((x) => x.bucketId === id);
    if ((b?.amount ?? 0) !== (a?.amount ?? 0)) out.push({ label: a?.name ?? b?.name ?? id, before: b?.amount ?? 0, after: a?.amount ?? 0 });
  }
  return out;
}
