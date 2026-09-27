import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { MoneyInput, PercentInput, Select } from "@/components/ui/inputs";
import { AllocationMeter, SplitBar } from "@/components/ui/SplitBar";
import { allocate, PRESETS, validateRule } from "@/domain/allocation";
import type { AllocationRule, Bucket, Centavos, RuleShare } from "@/domain/types";
import { formatMoney } from "@/lib/money";

/** Edit one allocation rule: fixed shares first, then a draggable percent split. */
export function RuleEditor({ rule, onChange, buckets, sampleNet }: { rule: AllocationRule; onChange: (r: AllocationRule) => void; buckets: Bucket[]; sampleNet: Centavos }) {
  const byId = new Map(buckets.map((b) => [b.id, b]));
  const fixed = rule.shares.map((s, i) => ({ s, i })).filter(({ s }) => s.kind === "fixed");
  const percent = rule.shares.map((s, i) => ({ s, i })).filter(({ s }) => s.kind === "percent");
  const unused = buckets.filter((b) => !rule.shares.some((s) => s.bucketId === b.id));
  const validation = validateRule(rule, buckets);

  const setShare = (i: number, patch: Partial<RuleShare>) => onChange({ ...rule, shares: rule.shares.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const removeShare = (i: number) => onChange({ ...rule, shares: rule.shares.filter((_, j) => j !== i) });
  const addShare = (kind: RuleShare["kind"]) => {
    const b = unused[0];
    if (!b) return;
    const share: RuleShare = { bucketId: b.id, kind, percent: 0, fixedAmount: kind === "fixed" ? 100000 : 0 };
    // Fixed shares go before percent shares so they're applied first.
    const shares = kind === "fixed" ? [...rule.shares.filter((s) => s.kind === "fixed"), share, ...rule.shares.filter((s) => s.kind === "percent")] : [...rule.shares, share];
    onChange({ ...rule, shares });
  };
  const applyPreset = (split: readonly number[]) => {
    const pct = rule.shares.filter((s) => s.kind === "percent");
    const ids = ["savings", "essentials", "wants"].filter((id) => byId.has(id));
    const targets = ids.length === 3 ? ids : pct.slice(0, 3).map((s) => s.bucketId);
    if (targets.length < 3) return;
    onChange({
      ...rule,
      shares: [
        ...rule.shares.filter((s) => s.kind === "fixed" && !targets.includes(s.bucketId)),
        ...targets.map((bucketId, k) => ({ bucketId, kind: "percent" as const, percent: split[k] ?? 0, fixedAmount: 0 })),
      ],
    });
  };
  const preview = allocate(sampleNet, rule, buckets);

  const bucketSelect = (i: number, value: string) => (
    <Select aria-label="Bucket" value={value} onChange={(e) => setShare(i, { bucketId: e.target.value })} className="min-w-0 flex-1">
      {[byId.get(value), ...unused].filter((b): b is Bucket => !!b).map((b) => (
        <option key={b.id} value={b.id}>
          {b.name}
        </option>
      ))}
    </Select>
  );

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-sm font-medium">Presets</p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <Button key={p.name} size="sm" variant="outline" onClick={() => applyPreset(p.split)}>
              <span className="money">{p.name}</span>
            </Button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Fixed amounts first</p>
        {fixed.length === 0 && <p className="mb-2 text-xs text-muted">Optional — e.g. ₱1,000 to an emergency fund before the split.</p>}
        <div className="space-y-2">
          {fixed.map(({ s, i }) => (
            <div key={i} className="flex items-center gap-2">
              {bucketSelect(i, s.bucketId)}
              <MoneyInput aria-label="Fixed amount" value={s.fixedAmount} onValueChange={(v) => setShare(i, { fixedAmount: v ?? 0 })} className="w-40" />
              <Button size="icon" variant="ghost" aria-label="Remove fixed share" onClick={() => removeShare(i)}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
        <Button size="sm" variant="ghost" className="mt-1" disabled={unused.length === 0} onClick={() => addShare("fixed")}>
          <Plus className="size-4" /> Fixed amount
        </Button>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-sm font-medium">Split the rest</p>
          <AllocationMeter total={validation.percentTotal} />
        </div>
        {percent.length > 0 && (
          <SplitBar
            segments={percent.map(({ s }) => ({ id: s.bucketId, label: byId.get(s.bucketId)?.name ?? "?", color: byId.get(s.bucketId)?.color ?? "var(--deduction)", percent: s.percent }))}
            onChange={(ps) => {
              const shares = [...rule.shares];
              percent.forEach(({ i }, k) => {
                const sh = shares[i];
                if (sh) shares[i] = { ...sh, percent: ps[k] ?? 0 };
              });
              onChange({ ...rule, shares });
            }}
          />
        )}
        <div className="mt-3 space-y-2">
          {percent.map(({ s, i }) => (
            <div key={i} className="flex items-center gap-2">
              {bucketSelect(i, s.bucketId)}
              <PercentInput aria-label={`${byId.get(s.bucketId)?.name ?? ""} percent`} value={s.percent} onValueChange={(v) => setShare(i, { percent: v })} className="w-28" />
              <Button size="icon" variant="ghost" aria-label="Remove share" disabled={percent.length <= 1} onClick={() => removeShare(i)}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
        <Button size="sm" variant="ghost" className="mt-1" disabled={unused.length === 0} onClick={() => addShare("percent")}>
          <Plus className="size-4" /> Percent share
        </Button>
      </div>

      <div className="rounded-md bg-surface-2 p-3 text-sm">
        <p className="mb-2 text-xs text-muted">
          Preview on a <span className="money">{formatMoney(sampleNet)}</span> net
        </p>
        <ul className="grid gap-1 sm:grid-cols-2">
          {preview.map((a) => (
            <li key={a.bucketId} className="flex justify-between gap-2">
              <span className="flex items-center gap-1.5">
                <span aria-hidden className="size-2 rounded-full" style={{ background: a.color }} />
                {a.name}
              </span>
              <span className="money">{formatMoney(a.amount)}</span>
            </li>
          ))}
        </ul>
      </div>
      {!validation.ok && (
        <ul role="alert" className="space-y-0.5 text-xs text-danger">
          {validation.errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
