import { AnimatePresence, motion, useMotionValue, useTransform } from "motion/react";
import { Trash2 } from "lucide-react";
import { LabelTag } from "@/components/ui/diy";
import { EmptyState } from "@/components/ui/misc";
import { toast } from "@/components/ui/Toast";
import type { Expense } from "@/domain/types";
import { formatMoney } from "@/lib/money";
import { longDate, todayISO, addDays } from "@/lib/periods";
import { useBucketMap, useCategoryMap } from "@/store/selectors";
import { useStore } from "@/store/useStore";
import { useUi } from "@/store/useUi";
import { Button } from "@/components/ui/Button";

function dayTitle(date: string): string {
  const today = todayISO();
  if (date === today) return "Today";
  if (date === addDays(today, -1)) return "Yesterday";
  return longDate(date);
}

function Row({ e }: { e: Expense }) {
  const categories = useCategoryMap();
  const buckets = useBucketMap();
  const openExpense = useUi((s) => s.openExpense);
  const cutoffExists = useStore((s) => s.cutoffs.some((c) => c.id === e.cutoffId));
  const x = useMotionValue(0);
  const bin = useTransform(x, [-120, -40, 0], [1, 0.4, 0]);
  const cat = categories.get(e.categoryId);
  const bucket = buckets.get(e.bucketId);

  const remove = () => {
    const s = useStore.getState();
    const snap = s.snapshot();
    s.removeExpense(e.id);
    toast(`Deleted ${formatMoney(e.amount)}`, { undo: () => useStore.getState().restore(snap) });
  };

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -60, transition: { duration: 0.18 } }}
      transition={{ type: "spring", stiffness: 500, damping: 38 }}
      className="relative overflow-hidden"
    >
      <motion.div aria-hidden style={{ opacity: bin }} className="absolute inset-y-0 right-0 flex w-28 items-center justify-end bg-danger pr-5 text-white">
        <Trash2 className="size-5" />
      </motion.div>
      <motion.div
        style={{ x }}
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0.5, right: 0 }}
        onDragEnd={(_, info) => {
          if (info.offset.x < -100) remove();
        }}
        className="relative flex items-center gap-2 bg-surface"
      >
        <button
          type="button"
          onClick={() => openExpense({ editing: e })}
          className="flex min-h-14 min-w-0 flex-1 items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-surface-2 md:px-5"
        >
          <span aria-hidden className="sticker grid size-9 shrink-0 place-items-center rounded-full text-lg">
            {cat?.emoji ?? "📦"}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{e.note || cat?.name || "Expense"}</span>
            <span className="flex items-center gap-2 text-xs text-muted">
              {e.note && <span className="truncate">{cat?.name}</span>}
              {!cutoffExists && <span className="text-wants">· unfunded</span>}
            </span>
          </span>
          <LabelTag color={bucket?.color} className="hidden sm:inline-flex">
            {bucket?.name ?? "—"}
          </LabelTag>
          <span className="money w-28 shrink-0 text-right text-sm font-semibold">−{formatMoney(e.amount)}</span>
        </button>
        <Button variant="ghost" size="icon" aria-label={`Delete ${e.note || cat?.name || "expense"}`} onClick={remove} className="mr-1 hidden text-muted hover:text-danger md:inline-flex">
          <Trash2 className="size-4" />
        </Button>
      </motion.div>
    </motion.li>
  );
}

export function ExpenseList({ days }: { days: { date: string; rows: Expense[]; total: number }[] }) {
  const openExpense = useUi((s) => s.openExpense);
  if (days.length === 0)
    return (
      <EmptyState
        title="Wala pang gastos"
        body="Nothing logged for this view. Add one — Enter saves and keeps the form open."
        action={<Button onClick={() => openExpense()}>+ Add expense</Button>}
      />
    );
  return (
    <div className="card overflow-clip p-0">
      {days.map((d) => (
        <section key={d.date} aria-label={dayTitle(d.date)}>
          <header className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface-2/95 px-4 py-2 backdrop-blur md:top-24 md:px-5">
            <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">{dayTitle(d.date)}</h3>
            <span className="money text-xs text-muted">{formatMoney(d.total)}</span>
          </header>
          <ul className="divide-y divide-line">
            <AnimatePresence initial={false}>
              {d.rows.map((e) => (
                <Row key={e.id} e={e} />
              ))}
            </AnimatePresence>
          </ul>
        </section>
      ))}
    </div>
  );
}
