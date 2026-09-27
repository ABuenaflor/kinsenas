import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/overlays";
import { toast } from "@/components/ui/Toast";
import { formatMoney } from "@/lib/money";
import { periodOf } from "@/lib/periods";
import { useStore } from "@/store/useStore";
import { useUi } from "@/store/useUi";
import { ExpenseForm, initialForm, useRecentCategories, type ExpenseFormValue } from "./ExpenseForm";

/** Global add/edit expense drawer (FAB, ⌘K, list rows, mobile quick add). */
export function ExpenseDrawer() {
  const { open, editing, prefill } = useUi((s) => s.expenseDrawer);
  const close = useUi((s) => s.closeExpense);
  const categories = useRecentCategories();
  const [value, setValue] = useState<ExpenseFormValue>(() => initialForm(useStore.getState().settings.paydays));

  const paydays = useStore((s) => s.settings.paydays);
  // Reset only when the drawer opens or its target changes (not when categories re-sort).
  useEffect(() => {
    if (open) setValue(initialForm(paydays, editing, prefill, categories[0]));
  }, [open, editing, prefill]);

  const submit = () => {
    if (value.amount === null) return;
    const s = useStore.getState();
    const snap = s.snapshot();
    const payload = {
      amount: value.amount,
      categoryId: value.categoryId,
      bucketId: value.bucketId,
      date: value.date,
      note: value.note.trim() || undefined,
    };
    const bucket = s.buckets.find((b) => b.id === value.bucketId)?.name ?? "";
    if (editing) {
      s.updateExpense(editing.id, { ...payload, cutoffId: value.cutoffOverride ?? periodOf(value.date, s.settings.paydays) });
      close();
      toast("Expense updated", { tone: "success", undo: () => useStore.getState().restore(snap) });
    } else {
      s.addExpense({ ...payload, cutoffId: value.cutoffOverride ?? undefined });
      toast(`Added ${formatMoney(value.amount)} · ${bucket}`, { tone: "success", undo: () => useStore.getState().restore(snap) });
      setValue((v) => ({ ...v, amount: null, note: "" }));
    }
  };

  return (
    <Drawer open={open} onClose={close} title={editing ? "Edit expense" : "Add expense"} description={editing ? undefined : "Enter saves and keeps this open for the next one."}>
      <ExpenseForm
        value={value}
        onChange={setValue}
        onSubmit={submit}
        submitLabel={editing ? "Save changes" : "Add"}
        extraActions={
          editing && (
            <Button
              variant="ghost"
              className="mr-auto text-danger"
              onClick={() => {
                const s = useStore.getState();
                const snap = s.snapshot();
                s.removeExpense(editing.id);
                close();
                toast("Expense deleted", { undo: () => useStore.getState().restore(snap) });
              }}
            >
              <Trash2 className="size-4" /> Delete
            </Button>
          )
        }
      />
    </Drawer>
  );
}
