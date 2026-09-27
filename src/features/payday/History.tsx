import { motion } from "motion/react";
import { Pencil, RotateCcw, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { SectionTitle } from "@/components/ui/Card";
import { TapeLabel } from "@/components/ui/diy";
import { EmptyState } from "@/components/ui/misc";
import { ConfirmDialog, Drawer } from "@/components/ui/overlays";
import { toast } from "@/components/ui/Toast";
import { buildCutoff, diffCutoff } from "@/domain/computeCutoff";
import { periodMetrics } from "@/domain/metrics";
import type { Cutoff } from "@/domain/types";
import { formatMoney } from "@/lib/money";
import { cutoffLabel, halfLabel, monthLabel, shortDate } from "@/lib/periods";
import { contextOf } from "@/store/slices/payday";
import { useStore } from "@/store/useStore";
import { Receipt } from "./Receipt";

function MiniSplit({ c }: { c: Cutoff }) {
  const total = c.allocations.reduce((s, a) => s + a.amount, 0);
  return (
    <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-surface-2" aria-hidden>
      {total > 0 && c.allocations.map((a) => <span key={a.bucketId} style={{ width: `${(a.amount / total) * 100}%`, background: a.color }} />)}
    </div>
  );
}

function CutoffDrawer({ cutoff, onClose }: { cutoff: Cutoff | null; onClose: () => void }) {
  const state = useStore();
  const paydays = state.settings.paydays;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showDiff, setShowDiff] = useState(false);

  const recomputed = useMemo(() => {
    if (!cutoff) return null;
    const ruleId = state.rules.some((r) => r.id === cutoff.ruleId) ? cutoff.ruleId : state.settings.activeRuleId;
    return buildCutoff({ ...cutoff, cutoffId: cutoff.id, ruleId }, contextOf(state), cutoff.updatedAt, cutoff);
  }, [cutoff, state]);
  const diff = cutoff && recomputed ? diffCutoff(cutoff, recomputed) : [];
  const ruleName = state.rules.find((r) => r.id === cutoff?.ruleId)?.name ?? "deleted rule";

  const close = () => {
    setShowDiff(false);
    onClose();
  };

  return (
    <>
      <Drawer
        open={!!cutoff}
        onClose={close}
        title={cutoff ? cutoffLabel(cutoff.id, paydays) : ""}
        description={cutoff ? `Paid ${shortDate(cutoff.payDate)} · rule: ${ruleName}` : undefined}
        footer={
          cutoff && (
            <>
              <Button variant="ghost" className="mr-auto text-danger" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="size-4" /> Delete
              </Button>
              <Button variant="outline" onClick={() => setShowDiff((v) => !v)} aria-expanded={showDiff}>
                <RotateCcw className="size-4" /> Re-apply current rules
              </Button>
              <Button
                onClick={() => {
                  state.setPeriod(cutoff.id);
                  close();
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                <Pencil className="size-4" /> Edit
              </Button>
            </>
          )
        }
      >
        {cutoff && (
          <div className="space-y-4">
            {showDiff && (
              <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="rounded-md border border-line bg-surface-2 p-4 text-sm">
                {diff.length === 0 ? (
                  <p>Nothing would change — this cutoff already matches your current rules.</p>
                ) : (
                  <>
                    <p className="mb-2 font-medium">Re-applying would change:</p>
                    <table className="w-full text-left">
                      <thead className="text-xs text-muted">
                        <tr>
                          <th className="py-1 font-normal">Line</th>
                          <th className="py-1 text-right font-normal">Now</th>
                          <th className="py-1 text-right font-normal">After</th>
                        </tr>
                      </thead>
                      <tbody className="money">
                        {diff.map((d) => (
                          <tr key={d.label}>
                            <td className="py-1 font-sans">{d.label}</td>
                            <td className="py-1 text-right text-muted">{formatMoney(d.before)}</td>
                            <td className="py-1 text-right">{formatMoney(d.after)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="mt-3 flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setShowDiff(false)}>
                        Keep as is
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          const snap = state.snapshot();
                          state.reapplyCutoff(cutoff.id);
                          setShowDiff(false);
                          toast("Re-applied current rules", { tone: "success", undo: () => useStore.getState().restore(snap) });
                        }}
                      >
                        Apply changes
                      </Button>
                    </div>
                  </>
                )}
              </motion.div>
            )}
            <Receipt
              title={`${halfLabel(cutoff.half, paydays)} cutoff`}
              subtitle={shortDate(cutoff.payDate)}
              gross={cutoff.gross}
              deductions={cutoff.deductions}
              net={cutoff.net}
              allocations={cutoff.allocations}
              govAlreadyDeducted={cutoff.govAlreadyDeducted}
              animate={false}
            />
            {cutoff.note && <p className="text-sm text-muted">Note: {cutoff.note}</p>}
          </div>
        )}
      </Drawer>
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this cutoff?"
        description="Expenses in this period stay, but will show as unfunded. Auto set-asides from this payday are removed."
        onConfirm={() => {
          if (!cutoff) return;
          const snap = state.snapshot();
          state.deleteCutoff(cutoff.id);
          close();
          toast(`Deleted ${cutoffLabel(cutoff.id, paydays)}`, { undo: () => useStore.getState().restore(snap) });
        }}
      />
    </>
  );
}

export function History() {
  const cutoffs = useStore((s) => s.cutoffs);
  const expenses = useStore((s) => s.expenses);
  const toBuy = useStore((s) => s.toBuy);
  const buckets = useStore((s) => s.buckets);
  const paydays = useStore((s) => s.settings.paydays);
  const [openId, setOpenId] = useState<string | null>(null);
  const open = cutoffs.find((c) => c.id === openId) ?? null;

  const groups = useMemo(() => {
    const sorted = [...cutoffs].sort((a, b) => b.id.localeCompare(a.id));
    const map = new Map<string, { c: Cutoff; saved: number }[]>();
    for (const c of sorted) {
      const saved = periodMetrics([c.id], { cutoffs, expenses, toBuy, buckets }).saved;
      const key = c.id.slice(0, 7);
      map.set(key, [...(map.get(key) ?? []), { c, saved }]);
    }
    return [...map.entries()];
  }, [cutoffs, expenses, toBuy, buckets]);

  return (
    <section aria-labelledby="history-h" className="mt-12">
      <SectionTitle eyebrow="History" title="Past cutoffs" />
      <span id="history-h" className="sr-only">
        History
      </span>
      {groups.length === 0 ? (
        <EmptyState title="No paydays yet" body="Your saved cutoffs will stack up here like receipts in a jar." />
      ) : (
        <div className="space-y-6">
          {groups.map(([month, rows]) => (
            <div key={month}>
              <TapeLabel seed={month} className="mb-3">
                {monthLabel(month, true)}
              </TapeLabel>
              <ul className="card divide-y divide-line overflow-hidden p-0">
                {rows.map(({ c, saved }) => (
                  <motion.li key={c.id} layout>
                    <button
                      type="button"
                      onClick={() => setOpenId(c.id)}
                      className="grid w-full grid-cols-[4.5rem_1fr_auto] items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2 md:grid-cols-[6rem_1fr_1fr_1fr_8rem] md:px-5"
                    >
                      <span className="text-sm font-medium">
                        {shortDate(c.payDate)}
                        <span className="block text-xs font-normal text-muted">{halfLabel(c.half, paydays)}</span>
                      </span>
                      <span className="money hidden text-sm text-muted md:block">
                        <span className="sr-only">Gross </span>
                        {formatMoney(c.gross)}
                      </span>
                      <span className="money text-sm font-semibold">
                        <span className="text-xs font-normal text-muted">net </span>
                        {formatMoney(c.net)}
                      </span>
                      <span className="money hidden text-sm text-savings md:block">
                        <span className="text-xs text-muted">saved </span>
                        {formatMoney(saved)}
                      </span>
                      <span className="w-20 md:w-auto">
                        <MiniSplit c={c} />
                      </span>
                    </button>
                  </motion.li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      <CutoffDrawer cutoff={open} onClose={() => setOpenId(null)} />
    </section>
  );
}
