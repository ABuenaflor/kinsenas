import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useLocation } from "react-router";
import { MagneticButton, Button } from "@/components/ui/Button";
import { LabelTag, MarginNote } from "@/components/ui/diy";
import { Field, MoneyInput, SegmentedControl, Select, Switch, TextInput } from "@/components/ui/inputs";
import { KeyboardHint } from "@/components/ui/misc";
import type { CutoffResult } from "@/domain/computeCutoff";
import { newId } from "@/lib/ids";
import { formatMoney } from "@/lib/money";
import { halfLabel, makeCutoffId, monthLabel, parseCutoffId, periodOf, shiftMonthKey, todayISO } from "@/lib/periods";
import { useStore } from "@/store/useStore";
import type { CutoffDraft } from "./useCutoffDraft";

interface Props {
  draft: CutoffDraft;
  update: (patch: Partial<CutoffDraft>) => void;
  preview: CutoffResult;
  editing: boolean;
  dirty: boolean;
  onSave: () => void;
}

export function CutoffInputCard({ draft, update, preview, editing, dirty, onSave }: Props) {
  const paydays = useStore((s) => s.settings.paydays);
  const rules = useStore((s) => s.rules);
  const cutoffs = useStore((s) => s.cutoffs);
  const setPeriod = useStore((s) => s.setPeriod);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const salaryRef = useRef<HTMLInputElement>(null);
  const location = useLocation();
  const adjustId = useId();
  const noteId = useId();
  const salaryId = useId();

  const focusToken = (location.state as { focusSalary?: number } | null)?.focusSalary;
  useEffect(() => {
    if (focusToken) salaryRef.current?.focus();
  }, [focusToken]);

  const { year, month, half } = parseCutoffId(draft.cutoffId);
  const monthKeyNow = todayISO().slice(0, 7);
  const currentKey = `${year}-${String(month).padStart(2, "0")}`;
  const monthOptions = Array.from({ length: 15 }, (_, i) => shiftMonthKey(monthKeyNow, 2 - i));
  if (!monthOptions.includes(currentKey)) monthOptions.push(currentKey);
  const loggedIds = new Set(cutoffs.map((c) => c.id));
  const firstRun = cutoffs.length === 0;
  const adj = draft.adjustments;

  return (
    <form
      className="card relative p-5 md:p-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (draft.gross !== null && draft.gross > 0) onSave();
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor={`${salaryId}-m`}>
          Month
        </label>
        <Select
          id={`${salaryId}-m`}
          value={currentKey}
          onChange={(e) => {
            const [y, m] = e.target.value.split("-").map(Number);
            setPeriod(makeCutoffId(y ?? year, m ?? month, half));
          }}
          className="w-36"
        >
          {monthOptions.map((k) => (
            <option key={k} value={k}>
              {monthLabel(k, true)}
            </option>
          ))}
        </Select>
        <SegmentedControl
          label="Payday"
          value={half}
          onChange={(h) => setPeriod(makeCutoffId(year, month, h))}
          options={(["A", "B"] as const).map((h) => ({
            value: h,
            label: (
              <>
                {halfLabel(h, paydays)}
                {loggedIds.has(makeCutoffId(year, month, h)) && <span aria-label="logged">✓</span>}
              </>
            ),
          }))}
        />
        <AnimatePresence>
          {editing && (
            <motion.span initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
              <LabelTag>Editing</LabelTag>
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <div className="relative mt-5">
        <label htmlFor={salaryId} className="mb-2 block text-sm font-medium">
          Gross salary this cutoff
        </label>
        <MoneyInput id={salaryId} ref={salaryRef} size="hero" value={draft.gross} onValueChange={(v) => update({ gross: v })} aria-describedby={`${salaryId}-h`} />
        <p id={`${salaryId}-h`} className="mt-1.5 text-xs text-muted">
          Before deductions. Paste from your payslip — commas are fine.
        </p>
        {firstRun && draft.gross === null && <MarginNote className="absolute -top-2 right-0 hidden lg:flex" arrow="down">sahod mo? start here</MarginNote>}
      </div>

      <Switch
        className="mt-3"
        checked={draft.govAlreadyDeducted}
        onCheckedChange={(v) => update({ govAlreadyDeducted: v })}
        label="My employer already deducted gov't contributions & tax"
        description="Enter your take-home; we'll skip SSS, PhilHealth, Pag-IBIG and tax."
      />

      <div className="mt-2 border-t border-line pt-2">
        <button
          type="button"
          aria-expanded={adjustOpen}
          aria-controls={adjustId}
          onClick={() => setAdjustOpen((o) => !o)}
          className="flex min-h-11 w-full items-center justify-between text-sm font-medium"
        >
          Adjust this cutoff
          <motion.span animate={{ rotate: adjustOpen ? 180 : 0 }}>
            <ChevronDown className="size-4 text-muted" />
          </motion.span>
        </button>
        <AnimatePresence initial={false}>
          {adjustOpen && (
            <motion.div
              id={adjustId}
              initial={{ opacity: 0, clipPath: "inset(0 0 100% 0)" }}
              animate={{ opacity: 1, clipPath: "inset(0 0 0% 0)" }}
              exit={{ opacity: 0, clipPath: "inset(0 0 100% 0)" }}
              transition={{ duration: 0.2 }}
              className="space-y-4 pb-2 pt-1"
            >
              <Field label="Allocation rule" htmlFor={`${adjustId}-rule`}>
                <Select id={`${adjustId}-rule`} value={draft.ruleId} onChange={(e) => update({ ruleId: e.target.value })}>
                  {rules.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </Select>
              </Field>

              {preview.deductions.some((d) => !d.key.startsWith("adj:")) && (
                <fieldset>
                  <legend className="mb-2 text-sm font-medium">Override a line (this cutoff only)</legend>
                  <div className="space-y-2">
                    {preview.deductions
                      .filter((d) => !d.key.startsWith("adj:"))
                      .map((d) => {
                        const overridden = d.key in adj.overrides;
                        return (
                          <div key={d.key} className="grid grid-cols-[1fr_9.5rem_auto] items-center gap-2">
                            <span className="truncate text-sm text-muted">{d.label}</span>
                            <MoneyInput
                              aria-label={`${d.label} amount`}
                              value={overridden ? (adj.overrides[d.key] ?? 0) : null}
                              placeholder={formatMoney(d.amount).replace("₱", "")}
                              onValueChange={(v) => {
                                const overrides = { ...adj.overrides };
                                if (v === null) delete overrides[d.key];
                                else overrides[d.key] = v;
                                update({ adjustments: { ...adj, overrides } });
                              }}
                            />
                            <span className="w-4 text-xs text-highlight" aria-label={overridden ? "overridden" : undefined}>
                              {overridden ? "●" : ""}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </fieldset>
              )}

              <fieldset>
                <legend className="mb-2 text-sm font-medium">One-time deductions</legend>
                <div className="space-y-2">
                  {adj.extras.map((x) => (
                    <div key={x.id} className="grid grid-cols-[1fr_9.5rem_auto] items-center gap-2">
                      <TextInput
                        aria-label="Deduction name"
                        placeholder="e.g. Uniform"
                        value={x.label}
                        onChange={(e) => update({ adjustments: { ...adj, extras: adj.extras.map((y) => (y.id === x.id ? { ...y, label: e.target.value } : y)) } })}
                      />
                      <MoneyInput
                        aria-label="Deduction amount"
                        value={x.amount}
                        onValueChange={(v) => update({ adjustments: { ...adj, extras: adj.extras.map((y) => (y.id === x.id ? { ...y, amount: v ?? 0 } : y)) } })}
                      />
                      <Button variant="ghost" size="icon" aria-label="Remove deduction" onClick={() => update({ adjustments: { ...adj, extras: adj.extras.filter((y) => y.id !== x.id) } })}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => update({ adjustments: { ...adj, extras: [...adj.extras, { id: newId(), label: "", amount: 0 }] } })}>
                    <Plus className="size-4" /> Add one-time deduction
                  </Button>
                </div>
              </fieldset>

              <Field label="Note" htmlFor={noteId}>
                <TextInput id={noteId} value={draft.note} onChange={(e) => update({ note: e.target.value })} placeholder="e.g. with OT pay" />
              </Field>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs text-muted">
          {draft.cutoffId > periodOf(todayISO(), paydays) ? "Heads up: this payday hasn't arrived yet." : editing ? "Saving replaces this cutoff's snapshot." : " "}
        </p>
        <MagneticButton type="submit" size="lg" disabled={draft.gross === null || draft.gross <= 0 || (editing && !dirty)} className="min-w-36">
          {editing ? "Update cutoff" : "Save cutoff"}
          <KeyboardHint keys={["↵"]} className="[&_kbd]:border-accent-ink/30 [&_kbd]:bg-transparent [&_kbd]:text-accent-ink/70" />
        </MagneticButton>
      </div>
    </form>
  );
}
