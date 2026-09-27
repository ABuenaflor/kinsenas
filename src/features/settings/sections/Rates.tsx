import { Plus, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { MoneyInput, PercentInput } from "@/components/ui/inputs";
import { ConfirmDialog } from "@/components/ui/overlays";
import { toast } from "@/components/ui/Toast";
import { RATES_REVIEWED } from "@/domain/govRates";
import type { Bps, Centavos, GovRates } from "@/domain/types";
import { useStore } from "@/store/useStore";

function MoneyCell({ label, value, onChange }: { label: string; value: Centavos; onChange: (v: Centavos) => void }) {
  return (
    <label className="block text-xs text-muted">
      {label}
      <MoneyInput className="mt-1" value={value} onValueChange={(v) => onChange(v ?? 0)} />
    </label>
  );
}
function PctCell({ label, value, onChange }: { label: string; value: Bps; onChange: (v: Bps) => void }) {
  return (
    <label className="block text-xs text-muted">
      {label}
      <PercentInput className="mt-1" value={value} onValueChange={onChange} />
    </label>
  );
}

export function RatesEditor() {
  const rates = useStore((s) => s.govRates);
  const setRates = useStore((s) => s.setGovRates);
  const reset = useStore((s) => s.resetGovRates);
  const [confirm, setConfirm] = useState(false);
  const set = <K extends "sss" | "philhealth" | "pagibig">(k: K, patch: Partial<GovRates[K]>) => setRates({ ...rates, [k]: { ...rates[k], ...patch } });
  const brackets = rates.withholdingSemiMonthly;
  // No re-sorting while typing (it would move focus); withholdingTax doesn't depend on order.
  const setBracket = (i: number, patch: Partial<(typeof brackets)[number]>) =>
    setRates({ ...rates, withholdingSemiMonthly: brackets.map((b, j) => (j === i ? { ...b, ...patch } : b)) });

  return (
    <div className="space-y-6">
      <p className="rounded-md bg-highlight/25 px-3 py-2 text-sm">
        Rates last reviewed: {RATES_REVIEWED} — verify against your payslip.
      </p>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">SSS</legend>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <PctCell label="Employee rate" value={rates.sss.employeeRate} onChange={(v) => set("sss", { employeeRate: v })} />
          <MoneyCell label="MSC min" value={rates.sss.mscMin} onChange={(v) => set("sss", { mscMin: v })} />
          <MoneyCell label="MSC max" value={rates.sss.mscMax} onChange={(v) => set("sss", { mscMax: v })} />
          <MoneyCell label="MSC step" value={rates.sss.mscStep} onChange={(v) => set("sss", { mscStep: Math.max(100, v) })} />
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">PhilHealth</legend>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <PctCell label="Employee rate" value={rates.philhealth.employeeRate} onChange={(v) => set("philhealth", { employeeRate: v })} />
          <MoneyCell label="Floor" value={rates.philhealth.floor} onChange={(v) => set("philhealth", { floor: v })} />
          <MoneyCell label="Ceiling" value={rates.philhealth.ceiling} onChange={(v) => set("philhealth", { ceiling: v })} />
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Pag-IBIG</legend>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <PctCell label="Low rate" value={rates.pagibig.lowRate} onChange={(v) => set("pagibig", { lowRate: v })} />
          <PctCell label="High rate" value={rates.pagibig.highRate} onChange={(v) => set("pagibig", { highRate: v })} />
          <MoneyCell label="Low threshold" value={rates.pagibig.lowThreshold} onChange={(v) => set("pagibig", { lowThreshold: v })} />
          <MoneyCell label="Max fund salary" value={rates.pagibig.maxFundSalary} onChange={(v) => set("pagibig", { maxFundSalary: v })} />
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Withholding tax (semi-monthly)</legend>
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_1fr_7rem_2.75rem] gap-2 text-xs text-muted">
            <span>Taxable over</span>
            <span>Base tax</span>
            <span>Rate on excess</span>
          </div>
          {brackets.map((b, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_7rem_2.75rem] items-center gap-2">
              <MoneyInput aria-label={`Bracket ${i + 1} over`} value={b.over} onValueChange={(v) => setBracket(i, { over: v ?? 0 })} />
              <MoneyInput aria-label={`Bracket ${i + 1} base`} value={b.base} onValueChange={(v) => setBracket(i, { base: v ?? 0 })} />
              <PercentInput aria-label={`Bracket ${i + 1} rate`} value={b.rate} onValueChange={(v) => setBracket(i, { rate: v })} />
              <Button size="icon" variant="ghost" aria-label={`Remove bracket ${i + 1}`} disabled={brackets.length <= 1} onClick={() => setRates({ ...rates, withholdingSemiMonthly: brackets.filter((_, j) => j !== i) })}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <Button size="sm" variant="outline" onClick={() => setRates({ ...rates, withholdingSemiMonthly: [...brackets, { over: (brackets[brackets.length - 1]?.over ?? 0) + 100000, base: 0, rate: 0 }] })}>
            <Plus className="size-4" /> Add bracket
          </Button>
        </div>
      </fieldset>
      <Button variant="outline" onClick={() => setConfirm(true)}>
        <RotateCcw className="size-4" /> Reset to 2026 defaults
      </Button>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        tone="solid"
        confirmLabel="Reset rates"
        title="Reset to 2026 defaults?"
        description="Saved cutoffs keep their snapshots. Only future calculations change."
        onConfirm={() => {
          const snap = useStore.getState().snapshot();
          reset();
          toast("Rates reset to PH 2026 defaults", { undo: () => useStore.getState().restore(snap) });
        }}
      />
    </div>
  );
}
