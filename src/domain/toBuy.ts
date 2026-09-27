import { pct, sum } from "@/lib/money";
import { nextCutoffId, payDateOf } from "@/lib/periods";
import type { AllocationLine, Centavos, CutoffId, ISODate, Paydays, ToBuyItem } from "./types";

export function fundedOf(item: Pick<ToBuyItem, "contributions">): Centavos {
  return Math.max(0, sum(item.contributions.map((c) => c.amount)));
}

export function toGoOf(item: ToBuyItem): Centavos {
  return Math.max(0, item.targetPrice - fundedOf(item));
}

/** Contributions count as "earmarked" only while the item is still being saved for. */
export function isEarmarking(item: ToBuyItem): boolean {
  return item.status === "saving" || item.status === "ready";
}

/** Status after a funding change; bought/archived are left alone. */
export function nextStatus(item: ToBuyItem): ToBuyItem["status"] {
  if (item.status === "bought" || item.status === "archived") return item.status;
  return item.targetPrice > 0 && fundedOf(item) >= item.targetPrice ? "ready" : "saving";
}

/** Average net contribution per cutoff that received money; falls back to the auto rule. */
export function avgContributionPerCutoff(item: ToBuyItem, bucketAllocation?: Centavos): Centavos {
  const byCutoff = new Map<CutoffId, Centavos>();
  for (const c of item.contributions) byCutoff.set(c.cutoffId, (byCutoff.get(c.cutoffId) ?? 0) + c.amount);
  const positive = [...byCutoff.values()].filter((v) => v > 0);
  if (positive.length > 0) return Math.round(sum(positive) / positive.length);
  if (item.autoContribution?.kind === "fixed") return item.autoContribution.amount;
  if (item.autoContribution?.kind === "percentOfBucket" && bucketAllocation) return pct(bucketAllocation, item.autoContribution.percent);
  return 0;
}

export interface Eta {
  paydays: number;
  cutoffId: CutoffId;
  date: ISODate;
}

/** Future paydays needed to fund the rest, counted from the cutoff after `currentCutoff`. */
export function etaOf(item: ToBuyItem, currentCutoff: CutoffId, paydays: Paydays, bucketAllocation?: Centavos): Eta | null {
  const toGo = toGoOf(item);
  if (toGo === 0) return { paydays: 0, cutoffId: currentCutoff, date: payDateOf(currentCutoff, paydays) };
  const avg = avgContributionPerCutoff(item, bucketAllocation);
  if (avg <= 0) return null;
  const n = Math.ceil(toGo / avg);
  if (n > 240) return null;
  let id = currentCutoff;
  for (let i = 0; i < n; i++) id = nextCutoffId(id);
  return { paydays: n, cutoffId: id, date: payDateOf(id, paydays) };
}

/** Auto set-aside for a freshly saved cutoff, capped at what's still needed. */
export function autoContributionFor(item: ToBuyItem, allocations: readonly AllocationLine[]): Centavos {
  if (item.status !== "saving" || !item.autoContribution) return 0;
  const toGo = toGoOf(item);
  let amount = 0;
  if (item.autoContribution.kind === "fixed") amount = item.autoContribution.amount;
  else {
    const alloc = allocations.find((a) => a.bucketId === item.bucketId)?.amount ?? 0;
    amount = pct(alloc, item.autoContribution.percent);
  }
  return Math.max(0, Math.min(amount, toGo));
}

/** Planned auto set-asides for a cutoff (shown on the Payday receipt). */
export function plannedSetAsides(
  items: readonly ToBuyItem[],
  allocations: readonly AllocationLine[],
): { itemId: string; name: string; bucketId: string; amount: Centavos }[] {
  return items
    .map((i) => ({ itemId: i.id, name: i.name, bucketId: i.bucketId, amount: autoContributionFor(i, allocations) }))
    .filter((x) => x.amount > 0);
}
