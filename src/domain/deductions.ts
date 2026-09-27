import { pct } from "@/lib/money";
import { parseCutoffId } from "@/lib/periods";
import type { Centavos, CustomDeduction, CutoffId, DeductionLine } from "./types";

export function customApplies(d: CustomDeduction, cutoffId: CutoffId): boolean {
  if (!d.active) return false;
  const { half } = parseCutoffId(cutoffId);
  if (d.schedule !== "every" && d.schedule !== half) return false;
  if (d.startCutoff && cutoffId < d.startCutoff) return false;
  if (d.endCutoff && cutoffId > d.endCutoff) return false;
  return true;
}

export function customAmount(d: CustomDeduction, gross: Centavos): Centavos {
  return d.kind === "fixed" ? d.amount : pct(gross, d.percent);
}

export function customDeductionLines(
  customs: readonly CustomDeduction[],
  cutoffId: CutoffId,
  gross: Centavos,
): DeductionLine[] {
  return [...customs]
    .sort((a, b) => a.order - b.order)
    .filter((d) => customApplies(d, cutoffId))
    .map((d) => ({
      key: `custom:${d.id}`,
      label: d.emoji ? `${d.emoji} ${d.name}` : d.name,
      source: "custom" as const,
      amount: customAmount(d, gross),
    }));
}
