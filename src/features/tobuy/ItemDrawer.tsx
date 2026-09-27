import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, MoneyInput, PercentInput, SegmentedControl, Select, TextInput } from "@/components/ui/inputs";
import { Drawer } from "@/components/ui/overlays";
import { toast } from "@/components/ui/Toast";
import type { AutoContribution, Bps, Centavos, ToBuyItem } from "@/domain/types";
import { useActiveBuckets } from "@/store/selectors";
import { useStore } from "@/store/useStore";
import { useUi } from "@/store/useUi";

interface FormState {
  name: string;
  targetPrice: Centavos | null;
  priority: ToBuyItem["priority"];
  bucketId: string;
  url: string;
  imageUrl: string;
  note: string;
  targetDate: string;
  autoKind: "none" | "fixed" | "percentOfBucket";
  autoAmount: Centavos | null;
  autoPercent: Bps;
}

function fromItem(item?: ToBuyItem): FormState {
  return {
    name: item?.name ?? "",
    targetPrice: item?.targetPrice ?? null,
    priority: item?.priority ?? "medium",
    bucketId: item?.bucketId ?? "wants",
    url: item?.url ?? "",
    imageUrl: item?.imageUrl ?? "",
    note: item?.note ?? "",
    targetDate: item?.targetDate ?? "",
    autoKind: item?.autoContribution?.kind ?? "none",
    autoAmount: item?.autoContribution?.kind === "fixed" ? item.autoContribution.amount : null,
    autoPercent: item?.autoContribution?.kind === "percentOfBucket" ? item.autoContribution.percent : 1000,
  };
}

const isHttpUrl = (s: string) => /^https?:\/\/\S+$/i.test(s);

/** Global add/edit To-Buy drawer. */
export function ItemDrawer() {
  const { open, editing } = useUi((s) => s.toBuyDrawer);
  const close = useUi((s) => s.closeToBuy);
  const buckets = useActiveBuckets();
  const id = useId();
  const [f, setF] = useState<FormState>(() => fromItem());
  const set = (patch: Partial<FormState>) => setF((x) => ({ ...x, ...patch }));

  useEffect(() => {
    if (open) setF(fromItem(editing));
  }, [open, editing]);

  const urlBad = (f.url && !isHttpUrl(f.url)) || (f.imageUrl && !isHttpUrl(f.imageUrl));
  const valid = f.name.trim() && f.targetPrice !== null && f.targetPrice > 0 && !urlBad && (f.autoKind !== "fixed" || (f.autoAmount ?? 0) > 0);

  const save = () => {
    if (!valid || f.targetPrice === null) return;
    const auto: AutoContribution =
      f.autoKind === "fixed" ? { kind: "fixed", amount: f.autoAmount ?? 0 } : f.autoKind === "percentOfBucket" ? { kind: "percentOfBucket", percent: f.autoPercent } : null;
    const draft = {
      name: f.name.trim(),
      targetPrice: f.targetPrice,
      priority: f.priority,
      bucketId: f.bucketId,
      url: f.url.trim() || undefined,
      imageUrl: f.imageUrl.trim() || undefined,
      note: f.note.trim() || undefined,
      targetDate: f.targetDate || undefined,
      autoContribution: auto,
    };
    const s = useStore.getState();
    const snap = s.snapshot();
    if (editing) s.updateItem(editing.id, draft);
    else s.addItem(draft);
    close();
    toast(editing ? "Item updated" : `Added “${draft.name}” to your list`, { tone: "success", undo: () => useStore.getState().restore(snap) });
  };

  return (
    <Drawer
      open={open}
      onClose={close}
      title={editing ? "Edit item" : "New To-Buy item"}
      description="Set money aside every payday until it's yours."
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!valid}>
            {editing ? "Save" : "Add to list"}
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Field label="What is it?" htmlFor={`${id}-n`}>
          <TextInput id={`${id}-n`} data-autofocus value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Standing desk" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Target price" htmlFor={`${id}-p`}>
            <MoneyInput id={`${id}-p`} value={f.targetPrice} onValueChange={(v) => set({ targetPrice: v })} />
          </Field>
          <Field label="Funded by" htmlFor={`${id}-b`}>
            <Select id={`${id}-b`} value={f.bucketId} onChange={(e) => set({ bucketId: e.target.value })}>
              {buckets.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">Priority</p>
          <SegmentedControl
            label="Priority"
            value={f.priority}
            onChange={(p) => set({ priority: p })}
            options={[
              { value: "low", label: "Low" },
              { value: "medium", label: "Medium" },
              { value: "high", label: "High" },
            ]}
          />
        </div>
        <fieldset className="rounded-md border border-line p-3">
          <legend className="px-1 text-sm font-medium">Auto set-aside each payday</legend>
          <SegmentedControl
            size="sm"
            label="Auto set-aside"
            value={f.autoKind}
            onChange={(k) => set({ autoKind: k })}
            options={[
              { value: "none", label: "Off" },
              { value: "fixed", label: "Fixed ₱" },
              { value: "percentOfBucket", label: "% of bucket" },
            ]}
          />
          {f.autoKind === "fixed" && (
            <Field className="mt-3" label="Per cutoff" htmlFor={`${id}-af`}>
              <MoneyInput id={`${id}-af`} value={f.autoAmount} onValueChange={(v) => set({ autoAmount: v })} />
            </Field>
          )}
          {f.autoKind === "percentOfBucket" && (
            <Field className="mt-3" label="Share of the bucket's allocation" htmlFor={`${id}-ap`}>
              <PercentInput id={`${id}-ap`} value={f.autoPercent} onValueChange={(v) => set({ autoPercent: v })} />
            </Field>
          )}
        </fieldset>
        <Field label="Target date (optional)" htmlFor={`${id}-d`}>
          <TextInput id={`${id}-d`} type="date" value={f.targetDate} onChange={(e) => set({ targetDate: e.target.value })} />
        </Field>
        <Field label="Link (optional)" htmlFor={`${id}-u`} error={f.url && !isHttpUrl(f.url) ? "Use a full https:// link" : undefined}>
          <TextInput id={`${id}-u`} type="url" value={f.url} onChange={(e) => set({ url: e.target.value })} placeholder="https://" />
        </Field>
        <Field label="Image URL (optional)" htmlFor={`${id}-i`} hint="Shows the item as a polaroid." error={f.imageUrl && !isHttpUrl(f.imageUrl) ? "Use a full https:// link" : undefined}>
          <TextInput id={`${id}-i`} type="url" value={f.imageUrl} onChange={(e) => set({ imageUrl: e.target.value })} placeholder="https://" />
        </Field>
        <Field label="Note" htmlFor={`${id}-note`}>
          <TextInput id={`${id}-note`} value={f.note} onChange={(e) => set({ note: e.target.value })} />
        </Field>
        <button type="submit" hidden />
      </form>
    </Drawer>
  );
}
