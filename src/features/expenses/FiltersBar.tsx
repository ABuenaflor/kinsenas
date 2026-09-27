import { AnimatePresence, m } from "motion/react";
import { ListFilter, Search, X } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Sticker } from "@/components/ui/diy";
import { Field, MoneyInput, Select } from "@/components/ui/inputs";
import { formatMoney } from "@/lib/money";
import { useActiveBuckets, useActiveCategories, useBucketMap, useCategoryMap } from "@/store/selectors";
import { EMPTY_FILTERS, type Filters } from "./useExpenseView";

export function FiltersBar({ filters, onChange, count }: { filters: Filters; onChange: (f: Filters) => void; count: number }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const categories = useActiveCategories();
  const buckets = useActiveBuckets();
  const catMap = useCategoryMap();
  const bucketMap = useBucketMap();
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });

  const chips: { key: string; label: string; clear: () => void }[] = [
    ...filters.categoryIds.map((c) => ({
      key: `c-${c}`,
      label: `${catMap.get(c)?.emoji ?? ""} ${catMap.get(c)?.name ?? c}`,
      clear: () => set({ categoryIds: filters.categoryIds.filter((x) => x !== c) }),
    })),
    ...(filters.bucketId ? [{ key: "b", label: bucketMap.get(filters.bucketId)?.name ?? "", clear: () => set({ bucketId: null }) }] : []),
    ...(filters.min !== null ? [{ key: "min", label: `≥ ${formatMoney(filters.min)}`, clear: () => set({ min: null }) }] : []),
    ...(filters.max !== null ? [{ key: "max", label: `≤ ${formatMoney(filters.max)}`, clear: () => set({ max: null }) }] : []),
  ];

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <label className="field flex flex-1 items-center gap-2">
          <Search className="size-4 text-muted" aria-hidden />
          <span className="sr-only">Search expenses</span>
          <input
            type="search"
            value={filters.search}
            onChange={(e) => set({ search: e.target.value })}
            placeholder="Search note or category"
            className="w-full bg-transparent outline-none placeholder:text-muted"
          />
        </label>
        <Button variant={open ? "solid" : "outline"} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={id}>
          <ListFilter className="size-4" /> Filters{count > 0 && <span className="money">({count})</span>}
        </Button>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <m.div
            id={id}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="card space-y-4 p-4"
          >
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Categories</legend>
              <div className="flex flex-wrap gap-2.5 p-1">
                {categories.map((c) => {
                  const on = filters.categoryIds.includes(c.id);
                  return (
                    <Sticker
                      key={c.id}
                      id={c.id}
                      selected={on}
                      aria-pressed={on}
                      onClick={() => set({ categoryIds: on ? filters.categoryIds.filter((x) => x !== c.id) : [...filters.categoryIds, c.id] })}
                    >
                      <span aria-hidden>{c.emoji}</span>
                      {c.name}
                    </Sticker>
                  );
                })}
              </div>
            </fieldset>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Bucket" htmlFor={`${id}-b`}>
                <Select id={`${id}-b`} value={filters.bucketId ?? ""} onChange={(e) => set({ bucketId: e.target.value || null })}>
                  <option value="">All buckets</option>
                  {buckets.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Min amount" htmlFor={`${id}-min`}>
                <MoneyInput id={`${id}-min`} value={filters.min} onValueChange={(v) => set({ min: v })} />
              </Field>
              <Field label="Max amount" htmlFor={`${id}-max`}>
                <MoneyInput id={`${id}-max`} value={filters.max} onValueChange={(v) => set({ max: v })} />
              </Field>
            </div>
          </m.div>
        )}
      </AnimatePresence>
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2.5 p-1">
          <AnimatePresence>
            {chips.map((c) => (
              <m.span key={c.key} layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}>
                <Sticker id={c.key} onClick={c.clear} aria-label={`Remove filter ${c.label}`} className="min-h-9 pr-2 text-xs">
                  {c.label} <X className="size-3.5" aria-hidden />
                </Sticker>
              </m.span>
            ))}
          </AnimatePresence>
          <button type="button" onClick={() => onChange({ ...EMPTY_FILTERS, search: filters.search })} className="min-h-9 px-2 text-xs text-muted underline-offset-4 hover:underline">
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
