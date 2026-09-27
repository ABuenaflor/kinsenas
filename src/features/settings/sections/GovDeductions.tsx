import { useId } from "react";
import { Field, MoneyInput, SegmentedControl, Switch } from "@/components/ui/inputs";
import { contributionForCutoff } from "@/domain/contributions";
import { GOV_LABELS } from "@/domain/govRates";
import { withholdingTax } from "@/domain/tax";
import type { GovDeduction, GovId } from "@/domain/types";
import { formatMoney } from "@/lib/money";
import { halfLabel } from "@/lib/periods";
import { useStore } from "@/store/useStore";

const HINTS: Record<GovId, string> = {
  sss: "5% employee share of your Monthly Salary Credit.",
  philhealth: "2.5% employee share of monthly basic (₱10k floor, ₱100k ceiling).",
  pagibig: "2% (1% if ≤ ₱1,500), capped at ₱10,000 fund salary.",
  tax: "TRAIN semi-monthly table on gross minus contributions. Estimate only.",
};

function GovCard({ g }: { g: GovDeduction }) {
  const id = useId();
  const settings = useStore((s) => s.settings);
  const rates = useStore((s) => s.govRates);
  const all = useStore((s) => s.govDeductions);
  const updateGov = useStore((s) => s.updateGovDeduction);
  const set = (patch: Partial<GovDeduction>) => updateGov(g.id, patch);
  const basis = settings.monthlyBasicSalary;

  let preview: string;
  if (!g.enabled) preview = "Off";
  else if (g.id === "tax") {
    if (g.mode === "fixed") preview = `${formatMoney(g.fixedAmount)} per cutoff`;
    else if (basis === null) preview = "Set a monthly basic salary to preview";
    else {
      const gross = Math.floor(basis / 2);
      const contribs = all.filter((x) => x.id !== "tax").reduce((s, x) => s + contributionForCutoff(x, basis, "A", rates), 0);
      preview = `≈ ${formatMoney(withholdingTax(gross - contribs, rates.withholdingSemiMonthly))} per cutoff`;
    }
  } else if (basis === null && g.mode === "auto") preview = "Set a monthly basic salary to preview";
  else {
    const a = contributionForCutoff(g, basis ?? 0, "A", rates);
    const b = contributionForCutoff(g, basis ?? 0, "B", rates);
    preview = a === b ? `${formatMoney(a)} per cutoff` : `${formatMoney(a)} on ${halfLabel("A", settings.paydays)} · ${formatMoney(b)} on ${halfLabel("B", settings.paydays)}`;
  }

  return (
    <div className="rounded-md border border-line p-4">
      <Switch checked={g.enabled} onCheckedChange={(v) => set({ enabled: v })} label={GOV_LABELS[g.id]} description={HINTS[g.id]} />
      {g.enabled && (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-2">
            <SegmentedControl
              size="sm"
              label={`${GOV_LABELS[g.id]} mode`}
              value={g.mode}
              onChange={(m) => set({ mode: m })}
              options={[
                { value: "auto", label: "Auto" },
                { value: "fixed", label: "Fixed" },
              ]}
            />
            {g.id !== "tax" && (
              <SegmentedControl
                size="sm"
                label={`${GOV_LABELS[g.id]} schedule`}
                value={g.schedule}
                onChange={(sc) => set({ schedule: sc })}
                options={[
                  { value: "split", label: "Split" },
                  { value: "A", label: `${halfLabel("A", settings.paydays)} only` },
                  { value: "B", label: `${halfLabel("B", settings.paydays)} only` },
                ]}
              />
            )}
          </div>
          {g.mode === "fixed" && (
            <Field label="Amount per applicable cutoff (from your payslip)" htmlFor={`${id}-f`}>
              <MoneyInput id={`${id}-f`} value={g.fixedAmount} onValueChange={(v) => set({ fixedAmount: v ?? 0 })} />
            </Field>
          )}
        </div>
      )}
      <p className="money mt-3 text-sm font-medium" aria-live="polite">
        {preview}
      </p>
    </div>
  );
}

export function GovDeductionsEditor() {
  const gov = useStore((s) => s.govDeductions);
  return (
    <div className="grid gap-3 xl:grid-cols-2">
      {gov.map((g) => (
        <GovCard key={g.id} g={g} />
      ))}
    </div>
  );
}
