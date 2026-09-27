import { Reorder, useDragControls } from "motion/react";
import { ArrowDown, ArrowUp, GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, MoneyInput, PercentInput, SegmentedControl, Switch, TextInput } from "@/components/ui/inputs";
import { MonthPicker } from "@/components/ui/MonthPicker";
import { Drawer } from "@/components/ui/overlays";
import { toast } from "@/components/ui/Toast";
import type { CustomDeduction } from "@/domain/types";
import { newId } from "@/lib/ids";
import { formatBps, formatMoney } from "@/lib/money";
import { cutoffLabel, halfLabel, isCutoffId } from "@/lib/periods";
import { useStore } from "@/store/useStore";

function blank(order: number): CustomDeduction {
  return { id: newId(), name: "", emoji: "", kind: "fixed", amount: 0, percent: 0, schedule: "every", active: true, order };
}

function DeductionDrawer({ value, onClose }: { value: CustomDeduction | null; onClose: () => void }) {
  const id = useId();
  const paydays = useStore((s) => s.settings.paydays);
  const upsert = useStore((s) => s.upsertCustomDeduction);
  const [d, setD] = useState<CustomDeduction | null>(value);
  const [prev, setPrev] = useState(value);
  if (value !== prev) {
    setPrev(value);
    setD(value);
  }
  const set = (patch: Partial<CustomDeduction>) => setD((x) => (x ? { ...x, ...patch } : x));
  const rangeBad = !!d && ((!!d.startCutoff && !isCutoffId(d.startCutoff)) || (!!d.endCutoff && !isCutoffId(d.endCutoff)) || (!!d.startCutoff && !!d.endCutoff && d.startCutoff > d.endCutoff));
  const valid = !!d && d.name.trim() !== "" && (d.kind === "fixed" ? d.amount > 0 : d.percent > 0) && !rangeBad;
  const toMonth = (c?: string) => (c ? c.slice(0, 7) : "");

  return (
    <Drawer
      open={!!value}
      onClose={onClose}
      title={d?.name ? `Edit ${d.name}` : "New deduction"}
      description="Loans, insurance, co-op — anything taken from your pay."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!valid}
            onClick={() => {
              if (!d) return;
              upsert({ ...d, name: d.name.trim(), emoji: d.emoji?.trim() || undefined });
              onClose();
            }}
          >
            Save
          </Button>
        </>
      }
    >
      {d && (
        <div className="space-y-4">
          <div className="grid grid-cols-[5rem_1fr] gap-3">
            <Field label="Emoji" htmlFor={`${id}-e`}>
              <TextInput id={`${id}-e`} value={d.emoji ?? ""} maxLength={4} onChange={(e) => set({ emoji: e.target.value })} placeholder="🏦" className="text-center" />
            </Field>
            <Field label="Name" htmlFor={`${id}-n`}>
              <TextInput id={`${id}-n`} data-autofocus value={d.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Company loan" />
            </Field>
          </div>
          <SegmentedControl
            label="Kind"
            value={d.kind}
            onChange={(k) => set({ kind: k })}
            options={[
              { value: "fixed", label: "Fixed ₱" },
              { value: "percent", label: "% of gross" },
            ]}
          />
          {d.kind === "fixed" ? (
            <Field label="Amount per applicable cutoff" htmlFor={`${id}-a`}>
              <MoneyInput id={`${id}-a`} value={d.amount || null} onValueChange={(v) => set({ amount: v ?? 0 })} />
            </Field>
          ) : (
            <Field label="Percent of gross" htmlFor={`${id}-p`}>
              <PercentInput id={`${id}-p`} value={d.percent} onValueChange={(v) => set({ percent: v })} />
            </Field>
          )}
          <div>
            <p className="mb-2 text-sm font-medium">When</p>
            <SegmentedControl
              label="Schedule"
              value={d.schedule}
              onChange={(s) => set({ schedule: s })}
              options={[
                { value: "every", label: "Every cutoff" },
                { value: "A", label: `${halfLabel("A", paydays)} only` },
                { value: "B", label: `${halfLabel("B", paydays)} only` },
              ]}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Starts (month)" htmlFor={`${id}-s`} hint="Optional">
              <MonthPicker id={`${id}-s`} label="Starts" clearable placeholder="Anytime" value={toMonth(d.startCutoff) || null} onChange={(v) => set({ startCutoff: v ? `${v}-A` : undefined })} />
            </Field>
            <Field label="Last installment (month)" htmlFor={`${id}-en`} hint="Optional" error={rangeBad ? "Ends before it starts" : undefined}>
              <MonthPicker id={`${id}-en`} label="Last installment" clearable placeholder="No end" value={toMonth(d.endCutoff) || null} onChange={(v) => set({ endCutoff: v ? `${v}-B` : undefined })} />
            </Field>
          </div>
          {(d.startCutoff || d.endCutoff) && (
            <p className="text-xs text-muted">
              Applies {d.startCutoff ? `from ${cutoffLabel(d.startCutoff, paydays)}` : ""} {d.endCutoff ? `through ${cutoffLabel(d.endCutoff, paydays)}` : ""}
            </p>
          )}
          <Switch checked={d.active} onCheckedChange={(v) => set({ active: v })} label="Active" />
        </div>
      )}
    </Drawer>
  );
}

/** List row that only starts dragging from its handle, so buttons and text stay clickable. */
function DragRow({ id, children }: { id: string; children: (startDrag: (e: React.PointerEvent) => void) => React.ReactNode }) {
  const controls = useDragControls();
  return (
    <Reorder.Item value={id} dragListener={false} dragControls={controls} className="flex items-center gap-1 bg-surface px-1.5 py-1.5">
      {children((e) => controls.start(e))}
    </Reorder.Item>
  );
}

export function CustomDeductionsEditor() {
  const list = useStore((s) => s.customDeductions);
  const paydays = useStore((s) => s.settings.paydays);
  const remove = useStore((s) => s.removeCustomDeduction);
  const reorder = useStore((s) => s.reorderCustomDeductions);
  const upsert = useStore((s) => s.upsertCustomDeduction);
  const [editing, setEditing] = useState<CustomDeduction | null>(null);
  const sorted = [...list].sort((a, b) => a.order - b.order);
  const move = (i: number, dir: -1 | 1) => {
    const ids = sorted.map((d) => d.id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j] ?? "", ids[i] ?? ""];
    reorder(ids);
  };

  return (
    <div>
      {sorted.length === 0 ? (
        <p className="mb-3 text-sm text-muted">No custom deductions yet.</p>
      ) : (
        <Reorder.Group axis="y" values={sorted.map((d) => d.id)} onReorder={reorder} className="mb-3 divide-y divide-line rounded-md border border-line">
          {sorted.map((d, i) => (
            <DragRow key={d.id} id={d.id}>
              {(startDrag) => (
            <>
              <button
                type="button"
                aria-label={`Drag to reorder ${d.name}`}
                onPointerDown={startDrag}
                className="grid size-11 shrink-0 cursor-grab touch-none place-items-center rounded-md text-muted hover:bg-surface-2 active:cursor-grabbing"
              >
                <GripVertical className="size-4" />
              </button>
              <span className="w-6 text-center" aria-hidden>
                {d.emoji || "•"}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-sm font-medium ${d.active ? "" : "text-muted line-through"}`}>{d.name}</span>
                <span className="money text-xs text-muted">
                  {d.kind === "fixed" ? formatMoney(d.amount) : `${formatBps(d.percent)} of gross`} · {d.schedule === "every" ? "every cutoff" : `${halfLabel(d.schedule, paydays)} only`}
                  {d.endCutoff && ` · until ${cutoffLabel(d.endCutoff, paydays)}`}
                </span>
              </span>
              <Button size="icon" variant="ghost" className="hidden sm:inline-flex" aria-label={`Move ${d.name} up`} disabled={i === 0} onClick={() => move(i, -1)}>
                <ArrowUp className="size-4" />
              </Button>
              <Button size="icon" variant="ghost" className="hidden sm:inline-flex" aria-label={`Move ${d.name} down`} disabled={i === sorted.length - 1} onClick={() => move(i, 1)}>
                <ArrowDown className="size-4" />
              </Button>
              <Button size="icon" variant="ghost" aria-label={`Edit ${d.name}`} onClick={() => setEditing(d)}>
                <Pencil className="size-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Delete ${d.name}`}
                onClick={() => {
                  remove(d.id);
                  toast(`Removed ${d.name}`, { undo: () => upsert(d) });
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            </>
              )}
            </DragRow>
          ))}
        </Reorder.Group>
      )}
      <Button variant="outline" onClick={() => setEditing(blank(sorted.length))}>
        <Plus className="size-4" /> Add deduction
      </Button>
      <DeductionDrawer value={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
