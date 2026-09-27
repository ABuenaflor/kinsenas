import { Archive, ArchiveRestore, Copy, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Switch, TextInput } from "@/components/ui/inputs";
import { toast } from "@/components/ui/Toast";
import { validateRule } from "@/domain/allocation";
import type { AllocationRule, Bucket } from "@/domain/types";
import { cn } from "@/lib/cn";
import { newId } from "@/lib/ids";
import { useActiveBuckets } from "@/store/selectors";
import { BUCKET_COLORS } from "@/store/defaults";
import { useStore } from "@/store/useStore";
import { RuleEditor } from "../RuleEditor";

export function SwatchPicker({ value, onChange, label }: { value: string; onChange: (c: string) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1">
      {BUCKET_COLORS.map((c, i) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          aria-label={`Color ${i + 1}`}
          onClick={() => onChange(c)}
          className="grid size-9 place-items-center rounded-full"
        >
          <span className={cn("size-6 rounded-full", value === c && "ring-2 ring-ink ring-offset-2 ring-offset-surface")} style={{ background: c }} />
        </button>
      ))}
    </div>
  );
}

function BucketRow({ b }: { b: Bucket }) {
  const upsert = useStore((s) => s.upsertBucket);
  const remove = useStore((s) => s.removeBucket);
  const restore = useStore((s) => s.restoreBucket);
  const [name, setName] = useState(b.name);
  // Follow outside renames (undo, import) without clobbering what's being typed otherwise.
  const [shownName, setShownName] = useState(b.name);
  if (shownName !== b.name) {
    setShownName(b.name);
    setName(b.name);
  }
  return (
    <li className={cn("space-y-2 px-3 py-3", b.archived && "opacity-60")}>
      <div className="flex items-center gap-2">
        <span aria-hidden className="size-4 shrink-0 rounded-full" style={{ background: b.color }} />
        <TextInput aria-label="Bucket name" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && upsert({ ...b, name: name.trim() })} className="flex-1" />
        {b.archived ? (
          <Button size="icon" variant="ghost" aria-label={`Restore ${b.name}`} onClick={() => restore(b.id)}>
            <ArchiveRestore className="size-4" />
          </Button>
        ) : (
          <Button
            size="icon"
            variant="ghost"
            aria-label={`Remove ${b.name}`}
            onClick={() => {
              const snap = useStore.getState().snapshot();
              const r = remove(b.id);
              if (!r.ok) toast(r.reason, { tone: "danger" });
              else toast(r.archived ? `${b.name} archived (it's used in history)` : `Removed ${b.name}`, { undo: () => useStore.getState().restore(snap) });
            }}
          >
            {b.id === "savings" || b.id === "essentials" || b.id === "wants" ? <Archive className="size-4" /> : <Trash2 className="size-4" />}
          </Button>
        )}
      </div>
      {!b.archived && (
        <div className="flex flex-wrap items-center justify-between gap-2 pl-6">
          <SwatchPicker label={`${b.name} color`} value={b.color} onChange={(c) => upsert({ ...b, color: c })} />
          <Switch className="min-w-56" checked={b.countsAsSavings} onCheckedChange={(v) => upsert({ ...b, countsAsSavings: v })} label="Counts as savings" />
        </div>
      )}
    </li>
  );
}

export function BucketsEditor() {
  const buckets = useStore((s) => s.buckets);
  const upsert = useStore((s) => s.upsertBucket);
  const sorted = [...buckets].sort((a, b) => Number(a.archived) - Number(b.archived) || a.order - b.order);
  return (
    <div>
      <ul className="mb-3 divide-y divide-line rounded-md border border-line">
        {sorted.map((b) => (
          <BucketRow key={b.id} b={b} />
        ))}
      </ul>
      <Button
        variant="outline"
        onClick={() =>
          upsert({
            id: newId(),
            name: "New bucket",
            color: BUCKET_COLORS[(buckets.length % (BUCKET_COLORS.length - 3)) + 3] ?? "var(--swatch-1)",
            countsAsSavings: false,
            archived: false,
            order: buckets.length,
          })
        }
      >
        <Plus className="size-4" /> Add bucket
      </Button>
    </div>
  );
}

export function RulesEditor() {
  const rules = useStore((s) => s.rules);
  const activeRuleId = useStore((s) => s.settings.activeRuleId);
  const upsertRule = useStore((s) => s.upsertRule);
  const removeRule = useStore((s) => s.removeRule);
  const setActive = useStore((s) => s.setActiveRule);
  const lastNet = useStore((s) => [...s.cutoffs].sort((a, b) => b.id.localeCompare(a.id))[0]?.net);
  const buckets = useActiveBuckets();
  const [selectedId, setSelectedId] = useState(activeRuleId);
  const stored = rules.find((r) => r.id === selectedId) ?? rules[0];
  const [draft, setDraft] = useState<AllocationRule | undefined>(stored);
  // Switching rules (or saving) loads the stored version into the editor.
  const [draftOf, setDraftOf] = useState(stored);
  if (draftOf !== stored) {
    setDraftOf(stored);
    setDraft(stored);
  }
  if (!draft || !stored) return null;
  const valid = validateRule(draft, buckets).ok;
  const dirty = JSON.stringify(draft) !== JSON.stringify(stored);

  return (
    <div className="space-y-4">
      <div role="radiogroup" aria-label="Rules" className="flex flex-wrap gap-2">
        {rules.map((r) => (
          <button
            key={r.id}
            type="button"
            role="radio"
            aria-checked={r.id === selectedId}
            onClick={() => setSelectedId(r.id)}
            className={cn("min-h-11 rounded-full border px-4 text-sm", r.id === selectedId ? "border-ink bg-ink text-accent-ink" : "border-line hover:border-ink")}
          >
            {r.name}
            {r.id === activeRuleId && <span className="ml-1.5 text-xs opacity-70">· active</span>}
          </button>
        ))}
        <Button
          variant="ghost"
          onClick={() => {
            const r: AllocationRule = { id: newId(), name: "New rule", shares: buckets.slice(0, 1).map((b) => ({ bucketId: b.id, kind: "percent", percent: 10000, fixedAmount: 0 })) };
            upsertRule(r);
            setSelectedId(r.id);
          }}
        >
          <Plus className="size-4" /> New rule
        </Button>
      </div>

      <Field label="Rule name" htmlFor="rule-name">
        <TextInput id="rule-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
      </Field>
      <RuleEditor rule={draft} onChange={setDraft} buckets={buckets} sampleNet={lastNet && lastNet > 0 ? lastNet : 1000000} />

      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
        <Button
          variant="ghost"
          className="text-danger"
          onClick={() => {
            const r = removeRule(stored.id);
            if (!r.ok) toast(r.reason, { tone: "danger" });
            else {
              toast(`Deleted ${stored.name}`, { undo: () => upsertRule(stored) });
              setSelectedId(activeRuleId);
            }
          }}
        >
          <Trash2 className="size-4" /> Delete
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            const copy = { ...structuredClone(stored), id: newId(), name: `${stored.name} (copy)` };
            upsertRule(copy);
            setSelectedId(copy.id);
          }}
        >
          <Copy className="size-4" /> Duplicate
        </Button>
        <span className="flex-1" />
        {stored.id !== activeRuleId && (
          <Button variant="outline" disabled={!valid || dirty} onClick={() => setActive(stored.id)}>
            Set as active
          </Button>
        )}
        <Button
          disabled={!valid || !dirty}
          onClick={() => {
            upsertRule({ ...draft, name: draft.name.trim() });
            toast("Rule saved · past cutoffs keep their snapshot", { tone: "success" });
          }}
        >
          Save rule
        </Button>
      </div>
    </div>
  );
}
