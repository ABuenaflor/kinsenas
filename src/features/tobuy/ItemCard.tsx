import { Archive, ArchiveRestore, ExternalLink, GripVertical, History, Minus, Pencil, Plus, ShoppingBag } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { LabelTag, Tape } from "@/components/ui/diy";
import { PaperConfetti, ProgressBar, ProgressRing } from "@/components/ui/progress";
import { etaOf, fundedOf, toGoOf } from "@/domain/toBuy";
import type { Bucket, ToBuyItem } from "@/domain/types";
import { cn } from "@/lib/cn";
import { seeded } from "@/lib/ids";
import { formatMoney, ratio } from "@/lib/money";
import { longDate, shortDate } from "@/lib/periods";
import { useStore } from "@/store/useStore";
import { useUi } from "@/store/useUi";
import { toast } from "@/components/ui/Toast";

const PRIORITY_LABEL = { high: "High", medium: "Med", low: "Low" } as const;

export interface CardActions {
  onAdd: (item: ToBuyItem) => void;
  onWithdraw: (item: ToBuyItem) => void;
  onBought: (item: ToBuyItem) => void;
  onHistory: (item: ToBuyItem) => void;
}

function Doodle({ seed }: { seed: string }) {
  const hue = Math.round((seeded(seed) + 1) * 3.5) + 1;
  return (
    <div className="grid h-full place-items-center" style={{ background: `color-mix(in oklab, var(--swatch-${hue}) 14%, var(--surface-2))` }}>
      <ShoppingBag className="size-10" style={{ color: `var(--swatch-${hue})` }} strokeWidth={1.5} aria-hidden />
    </div>
  );
}

export function ItemCard({ item, bucket, actions, dragHandle, confettiKey }: { item: ToBuyItem; bucket?: Bucket; actions: CardActions; dragHandle?: (e: React.PointerEvent) => void; confettiKey: number }) {
  const period = useStore((s) => s.ui.period);
  const paydays = useStore((s) => s.settings.paydays);
  const bucketAlloc = useStore((s) => s.cutoffs.find((c) => c.id === period)?.allocations.find((a) => a.bucketId === item.bucketId)?.amount);
  const openToBuy = useUi((s) => s.openToBuy);
  const [imgOk, setImgOk] = useState(true);
  const funded = fundedOf(item);
  const progress = ratio(funded, item.targetPrice);
  const toGo = toGoOf(item);
  const eta = item.status === "saving" ? etaOf(item, period, paydays, bucketAlloc) : null;
  const tilt = seeded(item.id) * 1.2;
  const polaroid = !!item.imageUrl && imgOk;
  const archived = item.status === "archived";

  const archiveToggle = () => {
    const s = useStore.getState();
    const snap = s.snapshot();
    s.setArchived(item.id, !archived);
    toast(archived ? "Restored" : `Archived ${item.name}`, { undo: () => useStore.getState().restore(snap) });
  };

  return (
    <div className={cn("relative pt-3", archived && "opacity-70")} style={{ rotate: `${tilt}deg` }}>
      <Tape seed={item.id} className="left-1/2 top-0 z-10 -translate-x-1/2" />
      <article className={cn("card relative overflow-visible", polaroid ? "p-3 pb-4" : "p-0")} aria-label={item.name}>
        <PaperConfetti fire={confettiKey} />
        <div className={cn("overflow-hidden", polaroid ? "aspect-[4/3] rounded-sm bg-surface-2" : "h-20 rounded-t-lg")}>
          {polaroid ? (
            <img src={item.imageUrl} alt="" loading="lazy" className="size-full object-cover" onError={() => setImgOk(false)} />
          ) : (
            <Doodle seed={item.id} />
          )}
        </div>
        <div className={cn(polaroid ? "px-1 pt-3" : "p-4")}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className={cn("truncate text-lg font-semibold leading-tight", polaroid && "font-hand text-2xl font-semibold")}>{item.name}</h2>
              <p className="money text-sm text-muted">{formatMoney(item.targetPrice)}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {dragHandle && (
                <button type="button" aria-label={`Drag to reorder ${item.name}`} onPointerDown={dragHandle} className="grid size-11 cursor-grab touch-none place-items-center rounded-md text-muted hover:bg-surface-2 active:cursor-grabbing">
                  <GripVertical className="size-4" />
                </button>
              )}
              <ProgressRing value={progress} size={48} stroke={5} color={bucket?.color} label={`${item.name} funded`}>
                <span className="money text-[11px] font-semibold">{Math.min(999, Math.round(progress * 100))}%</span>
              </ProgressRing>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <LabelTag>{PRIORITY_LABEL[item.priority]}</LabelTag>
            {bucket && <LabelTag color={bucket.color}>{bucket.name}</LabelTag>}
            {item.status === "ready" && <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">Ready to buy</span>}
          </div>
          <div className="mt-3">
            <ProgressBar value={progress} color={bucket?.color ?? "var(--savings)"} label={`${item.name} progress`} />
            <div className="mt-1.5 flex justify-between gap-2 text-xs text-muted">
              <span className="money">{formatMoney(funded)} set aside</span>
              <span className="money">{toGo > 0 ? `${formatMoney(toGo)} to go` : "Fully funded ✓"}</span>
            </div>
            <p className="mt-1 text-xs text-muted">
              {item.status === "saving" &&
                (eta ? `ETA ${shortDate(eta.date)} · ${eta.paydays} payday${eta.paydays === 1 ? "" : "s"}` : "Add a contribution to see ETA")}
              {item.targetDate && ` · target ${longDate(item.targetDate)}`}
            </p>
          </div>
          {!archived ? (
            <div className="mt-3 flex flex-wrap items-center gap-1">
              <Button size="sm" onClick={() => actions.onAdd(item)}>
                <Plus className="size-4" /> Add money
              </Button>
              <Button size="sm" variant={item.status === "ready" ? "highlight" : "outline"} onClick={() => actions.onBought(item)}>
                <ShoppingBag className="size-4" /> Bought
              </Button>
              <span className="ml-auto flex">
                <Button size="icon" variant="ghost" aria-label="Withdraw" disabled={funded === 0} onClick={() => actions.onWithdraw(item)}>
                  <Minus className="size-4" />
                </Button>
                <Button size="icon" variant="ghost" aria-label="Contribution history" onClick={() => actions.onHistory(item)}>
                  <History className="size-4" />
                </Button>
                <Button size="icon" variant="ghost" aria-label="Edit" onClick={() => openToBuy(item)}>
                  <Pencil className="size-4" />
                </Button>
                {item.url && (
                  <a href={item.url} target="_blank" rel="noreferrer noopener" aria-label="Open link" className="grid size-11 place-items-center rounded-md text-ink hover:bg-surface-2">
                    <ExternalLink className="size-4" />
                  </a>
                )}
                <Button size="icon" variant="ghost" aria-label="Archive" onClick={archiveToggle}>
                  <Archive className="size-4" />
                </Button>
              </span>
            </div>
          ) : (
            <Button size="sm" variant="outline" className="mt-3" onClick={archiveToggle}>
              <ArchiveRestore className="size-4" /> Restore
            </Button>
          )}
        </div>
      </article>
    </div>
  );
}

