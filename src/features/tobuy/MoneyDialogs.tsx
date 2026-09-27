import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, MoneyInput, Select, TextInput } from "@/components/ui/inputs";
import { Dialog } from "@/components/ui/overlays";
import { toast } from "@/components/ui/Toast";
import { fundedOf, toGoOf } from "@/domain/toBuy";
import type { ToBuyItem } from "@/domain/types";
import { formatMoney } from "@/lib/money";
import { cutoffLabel, payDateOf, prevCutoffId, nextCutoffId, todayISO } from "@/lib/periods";
import { useMetrics } from "@/store/selectors";
import { useStore } from "@/store/useStore";

/** Add money to (or withdraw from) an item for a chosen cutoff. */
export function ContributionDialog({ item, mode, onClose, onFunded }: { item: ToBuyItem | null; mode: "add" | "withdraw"; onClose: () => void; onFunded?: () => void }) {
  const id = useId();
  const period = useStore((s) => s.ui.period);
  const paydays = useStore((s) => s.settings.paydays);
  const [amount, setAmount] = useState<number | null>(null);
  const [cutoffId, setCutoffId] = useState(period);
  useEffect(() => {
    if (item) {
      setAmount(mode === "add" ? Math.min(toGoOf(item), 100000) || null : null);
      setCutoffId(period);
    }
  }, [item, mode, period]);
  const metrics = useMetrics([cutoffId]);
  if (!item) return <Dialog open={false} onClose={onClose} title="" />;

  const bucket = metrics.buckets.find((b) => b.bucketId === item.bucketId);
  const funded = fundedOf(item);
  const tooMuch = mode === "withdraw" && amount !== null && amount > funded;
  const exceedsBucket = mode === "add" && amount !== null && bucket !== undefined && amount > bucket.remaining;
  const ok = amount !== null && amount > 0 && !tooMuch;

  const submit = () => {
    if (!ok || amount === null) return;
    const s = useStore.getState();
    const snap = s.snapshot();
    const wasReady = funded >= item.targetPrice;
    s.addContribution(item.id, { amount: mode === "add" ? amount : -amount, cutoffId, date: payDateOf(cutoffId, paydays) <= todayISO() ? todayISO() : payDateOf(cutoffId, paydays) });
    if (mode === "add" && !wasReady && funded + amount >= item.targetPrice) onFunded?.();
    toast(mode === "add" ? `Set aside ${formatMoney(amount)} for ${item.name}` : `Took back ${formatMoney(amount)}`, {
      tone: "success",
      undo: () => useStore.getState().restore(snap),
    });
    onClose();
  };

  const options = [prevCutoffId(period), period, nextCutoffId(period)];
  return (
    <Dialog
      open
      onClose={onClose}
      title={mode === "add" ? `Add money · ${item.name}` : `Withdraw · ${item.name}`}
      description={`${formatMoney(funded)} set aside of ${formatMoney(item.targetPrice)}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!ok}>
            {mode === "add" ? "Set aside" : "Withdraw"}
          </Button>
        </>
      }
    >
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Field label="Amount" htmlFor={`${id}-a`} error={tooMuch ? `Only ${formatMoney(funded)} is set aside.` : undefined}>
          <MoneyInput id={`${id}-a`} data-autofocus size="lg" value={amount} onValueChange={setAmount} />
        </Field>
        <Field label="From which cutoff?" htmlFor={`${id}-c`}>
          <Select id={`${id}-c`} value={cutoffId} onChange={(e) => setCutoffId(e.target.value)}>
            {options.map((o) => (
              <option key={o} value={o}>
                {cutoffLabel(o, paydays)}
              </option>
            ))}
          </Select>
        </Field>
        {exceedsBucket && bucket && (
          <p role="status" className="rounded-md bg-wants/10 px-3 py-2 text-sm text-ink">
            Heads up: {bucket.name} only has {formatMoney(Math.max(0, bucket.remaining))} left this cutoff. You can still set it aside.
          </p>
        )}
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}

/** Ask actual price & date, then create the purchase expense. */
export function BoughtDialog({ item, onClose, onBought }: { item: ToBuyItem | null; onClose: () => void; onBought: () => void }) {
  const id = useId();
  const [price, setPrice] = useState<number | null>(null);
  const [date, setDate] = useState(todayISO());
  useEffect(() => {
    if (item) {
      setPrice(item.targetPrice);
      setDate(todayISO());
    }
  }, [item]);
  if (!item) return <Dialog open={false} onClose={onClose} title="" />;
  const submit = () => {
    if (price === null || price <= 0 || !date) return;
    const s = useStore.getState();
    const snap = s.snapshot();
    s.markBought(item.id, price, date);
    onBought();
    toast(`Nabili na! ${item.name} logged as ${formatMoney(price)}`, { tone: "success", undo: () => useStore.getState().restore(snap) });
    onClose();
  };
  return (
    <Dialog
      open
      onClose={onClose}
      title={`Bought ${item.name}?`}
      description="We'll log it as an expense in the item's bucket. The money you set aside stops counting as earmarked."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="highlight" onClick={submit} disabled={price === null || price <= 0}>
            Mark as bought
          </Button>
        </>
      }
    >
      <form
        className="grid grid-cols-2 gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Field label="Actual price" htmlFor={`${id}-p`}>
          <MoneyInput id={`${id}-p`} data-autofocus value={price} onValueChange={setPrice} />
        </Field>
        <Field label="Date" htmlFor={`${id}-d`}>
          <TextInput id={`${id}-d`} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
