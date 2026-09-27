import { ArchiveRestore, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Select, TextInput } from "@/components/ui/inputs";
import { toast } from "@/components/ui/Toast";
import type { Category } from "@/domain/types";
import { cn } from "@/lib/cn";
import { newId } from "@/lib/ids";
import { SWATCHES } from "@/store/defaults";
import { useActiveBuckets } from "@/store/selectors";
import { useStore } from "@/store/useStore";

function CategoryRow({ c }: { c: Category }) {
  const upsert = useStore((s) => s.upsertCategory);
  const remove = useStore((s) => s.removeCategory);
  const restore = useStore((s) => s.restoreCategory);
  const buckets = useActiveBuckets();
  const [name, setName] = useState(c.name);
  const [emoji, setEmoji] = useState(c.emoji);
  useEffect(() => {
    setName(c.name);
    setEmoji(c.emoji);
  }, [c.name, c.emoji]);
  const nextColor = () => SWATCHES[(SWATCHES.indexOf(c.color as (typeof SWATCHES)[number]) + 1) % SWATCHES.length] ?? SWATCHES[0];

  return (
    <li className={cn("grid grid-cols-[3.5rem_2.75rem_1fr] items-center gap-2 px-3 py-2 sm:grid-cols-[3.5rem_2.75rem_1fr_10rem_2.75rem]", c.archived && "opacity-60")}>
      <TextInput aria-label="Emoji" value={emoji} maxLength={4} className="px-2 text-center" onChange={(e) => setEmoji(e.target.value)} onBlur={() => emoji.trim() && upsert({ ...c, emoji: emoji.trim() })} />
      <button type="button" aria-label={`Change ${c.name} color`} onClick={() => upsert({ ...c, color: nextColor() })} className="grid size-11 place-items-center">
        <span className="size-6 rounded-full" style={{ background: c.color }} />
      </button>
      <TextInput aria-label="Category name" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && upsert({ ...c, name: name.trim() })} />
      <Select aria-label={`${c.name} default bucket`} value={c.defaultBucketId ?? ""} onChange={(e) => upsert({ ...c, defaultBucketId: e.target.value || undefined })} className="col-span-2 sm:col-span-1">
        <option value="">No default</option>
        {buckets.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </Select>
      {c.archived ? (
        <Button size="icon" variant="ghost" aria-label={`Restore ${c.name}`} onClick={() => restore(c.id)}>
          <ArchiveRestore className="size-4" />
        </Button>
      ) : (
        <Button
          size="icon"
          variant="ghost"
          aria-label={`Remove ${c.name}`}
          onClick={() => {
            const snap = useStore.getState().snapshot();
            const r = remove(c.id);
            if (r.ok) toast(r.archived ? `${c.name} archived (used by expenses)` : `Removed ${c.name}`, { undo: () => useStore.getState().restore(snap) });
          }}
        >
          <Trash2 className="size-4" />
        </Button>
      )}
    </li>
  );
}

export function CategoriesEditor() {
  const categories = useStore((s) => s.categories);
  const upsert = useStore((s) => s.upsertCategory);
  const sorted = [...categories].sort((a, b) => Number(a.archived) - Number(b.archived));
  return (
    <div>
      <ul className="mb-3 divide-y divide-line rounded-md border border-line">
        {sorted.map((c) => (
          <CategoryRow key={c.id} c={c} />
        ))}
      </ul>
      <Button variant="outline" onClick={() => upsert({ id: newId(), name: "New category", emoji: "✨", color: SWATCHES[categories.length % SWATCHES.length] ?? SWATCHES[0], defaultBucketId: "wants", archived: false })}>
        <Plus className="size-4" /> Add category
      </Button>
    </div>
  );
}
