import { sum } from "@/lib/money";
import type { AllocationLine, AllocationRule, Bps, Bucket, Centavos, RuleShare } from "./types";

export interface RuleValidation {
  ok: boolean;
  percentTotal: Bps;
  errors: string[];
}

export function validateRule(rule: AllocationRule, buckets?: readonly Bucket[]): RuleValidation {
  const errors: string[] = [];
  const percentShares = rule.shares.filter((s) => s.kind === "percent");
  const percentTotal = sum(percentShares.map((s) => s.percent));
  if (!rule.name.trim()) errors.push("Give the rule a name.");
  if (percentShares.length === 0) errors.push("Add at least one percent share.");
  if (percentShares.length > 0 && percentTotal !== 10000) errors.push("Percent shares must total exactly 100%.");
  if (rule.shares.some((s) => s.percent < 0 || s.fixedAmount < 0)) errors.push("Shares can't be negative.");
  const ids = rule.shares.map((s) => s.bucketId);
  if (new Set(ids).size !== ids.length) errors.push("Each bucket can appear only once.");
  if (buckets && ids.some((id) => !buckets.some((b) => b.id === id))) errors.push("A share points to a missing bucket.");
  return { ok: errors.length === 0, percentTotal, errors };
}

/**
 * Split `amount` across weights (bps) so parts sum to exactly `amount`.
 * Largest-remainder: floor each; leftover centavos go by largest fraction,
 * ties → larger bps → earlier order.
 */
export function largestRemainder(amount: Centavos, weights: readonly Bps[]): Centavos[] {
  const total = sum(weights);
  if (amount <= 0 || total <= 0) return weights.map(() => 0);
  // Integer math: part = floor(amount·w / total), remainder compared as integers.
  const parts = weights.map((w) => Math.floor((amount * w) / total));
  let leftover = amount - sum(parts);
  const order = weights
    .map((w, i) => ({ i, w, frac: amount * w - (parts[i] ?? 0) * total }))
    .sort((a, b) => b.frac - a.frac || b.w - a.w || a.i - b.i);
  for (let k = 0; leftover > 0 && order.length > 0; k = (k + 1) % order.length) {
    const target = order[k];
    if (target) parts[target.i] = (parts[target.i] ?? 0) + 1;
    leftover--;
  }
  return parts;
}

/** Fixed shares first (capped at what's left), then percent shares split the remainder. */
export function allocateAmounts(net: Centavos, shares: readonly RuleShare[]): Centavos[] {
  const out = shares.map(() => 0);
  let remaining = Math.max(0, net);
  shares.forEach((s, i) => {
    if (s.kind !== "fixed") return;
    const amt = Math.min(Math.max(0, s.fixedAmount), remaining);
    out[i] = amt;
    remaining -= amt;
  });
  const pIdx = shares.map((s, i) => (s.kind === "percent" ? i : -1)).filter((i) => i >= 0);
  const parts = largestRemainder(
    remaining,
    pIdx.map((i) => shares[i]?.percent ?? 0),
  );
  pIdx.forEach((i, k) => (out[i] = parts[k] ?? 0));
  return out;
}

export function allocate(net: Centavos, rule: AllocationRule, buckets: readonly Bucket[]): AllocationLine[] {
  const amounts = allocateAmounts(net, rule.shares);
  return rule.shares.map((s, i) => {
    const b = buckets.find((x) => x.id === s.bucketId);
    return {
      bucketId: s.bucketId,
      name: b?.name ?? "Unknown",
      color: b?.color ?? "var(--deduction)",
      countsAsSavings: b?.countsAsSavings ?? false,
      amount: amounts[i] ?? 0,
    };
  });
}

export const PRESETS: { name: string; split: [Bps, Bps, Bps] }[] = [
  { name: "50 / 30 / 20", split: [5000, 3000, 2000] },
  { name: "70 / 20 / 10", split: [7000, 2000, 1000] },
  { name: "60 / 30 / 10", split: [6000, 3000, 1000] },
  { name: "20 / 50 / 30", split: [2000, 5000, 3000] },
];

/** Build percent shares for [savings, essentials, wants] bucket ids. */
export function presetShares(bucketIds: readonly [string, string, string], split: readonly [Bps, Bps, Bps]): RuleShare[] {
  return bucketIds.map((bucketId, i) => ({ bucketId, kind: "percent" as const, percent: split[i] ?? 0, fixedAmount: 0 }));
}
