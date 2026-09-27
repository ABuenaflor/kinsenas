import { AnimatePresence, motion, Reorder, useDragControls } from "motion/react";
import { ChevronDown, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PeriodSwitcher";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SegmentedControl } from "@/components/ui/inputs";
import { TabPanel, Tabs } from "@/components/ui/Tabs";
import { EmptyState } from "@/components/ui/misc";
import { Drawer } from "@/components/ui/overlays";
import { NumberTicker } from "@/components/ui/NumberTicker";
import { PaperConfetti, ProgressRing } from "@/components/ui/progress";
import { toast } from "@/components/ui/Toast";
import { fundedOf } from "@/domain/toBuy";
import type { ToBuyItem } from "@/domain/types";
import { formatMoney, ratio } from "@/lib/money";
import { cutoffLabel, longDate } from "@/lib/periods";
import { useBucketMap } from "@/store/selectors";
import { useStore } from "@/store/useStore";
import { useUi } from "@/store/useUi";
import { ItemCard, type CardActions } from "./ItemCard";
import { BoughtDialog, ContributionDialog } from "./MoneyDialogs";

type Sort = "manual" | "priority" | "progress" | "date";
type StatusFilter = "active" | "ready" | "archived";
const PRIORITY_RANK = { high: 0, medium: 1, low: 2 } as const;

function ReorderRow({ item, children }: { item: ToBuyItem; children: (start: (e: React.PointerEvent) => void) => React.ReactNode }) {
  const controls = useDragControls();
  return (
    <Reorder.Item value={item.id} dragListener={false} dragControls={controls} className="list-none">
      {children((e) => controls.start(e))}
    </Reorder.Item>
  );
}

function HistoryDrawer({ item, onClose }: { item: ToBuyItem | null; onClose: () => void }) {
  const paydays = useStore((s) => s.settings.paydays);
  const live = useStore((s) => s.toBuy.find((t) => t.id === item?.id)) ?? item;
  const rows = [...(live?.contributions ?? [])].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <Drawer open={!!item} onClose={onClose} title={live?.name ?? ""} description={live ? `${formatMoney(fundedOf(live))} of ${formatMoney(live.targetPrice)} set aside` : undefined}>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">No contributions yet.</p>
      ) : (
        <ol className="relative ml-2 space-y-4 border-l-2 border-dashed border-line pl-5">
          {rows.map((c) => (
            <li key={c.id} className="relative">
              <span aria-hidden className="absolute -left-[27px] top-1.5 size-3 rounded-full border-2 border-surface" style={{ background: c.amount < 0 ? "var(--danger)" : "var(--savings)" }} />
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className={`money text-sm font-semibold ${c.amount < 0 ? "text-danger" : ""}`}>
                    {c.amount < 0 ? "−" : "+"}
                    {formatMoney(Math.abs(c.amount))}
                  </p>
                  <p className="text-xs text-muted">
                    {longDate(c.date)} · {cutoffLabel(c.cutoffId, paydays)} {c.auto && "· auto"}
                  </p>
                </div>
                {live && live.status !== "bought" && (
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Remove contribution"
                    onClick={() => {
                      const s = useStore.getState();
                      const snap = s.snapshot();
                      s.removeContribution(live.id, c.id);
                      toast("Contribution removed", { undo: () => useStore.getState().restore(snap) });
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </Drawer>
  );
}

export default function ToBuyPage() {
  const toBuy = useStore((s) => s.toBuy);
  const reorderItems = useStore((s) => s.reorderItems);
  const buckets = useBucketMap();
  const openToBuy = useUi((s) => s.openToBuy);
  const [sort, setSort] = useState<Sort>("manual");
  const [status, setStatus] = useState<StatusFilter>("active");
  const [showBought, setShowBought] = useState(false);
  const [contrib, setContrib] = useState<{ item: ToBuyItem; mode: "add" | "withdraw" } | null>(null);
  const [buying, setBuying] = useState<ToBuyItem | null>(null);
  const [historyItem, setHistoryItem] = useState<ToBuyItem | null>(null);
  const [confetti, setConfetti] = useState<Record<string, number>>({});
  const [pageBurst, setPageBurst] = useState(0); // bought items leave the grid, so celebrate over the page
  const burst = (id: string) => setConfetti((c) => ({ ...c, [id]: (c[id] ?? 0) + 1 }));

  const active = toBuy.filter((t) => t.status === "saving" || t.status === "ready");
  const bought = toBuy.filter((t) => t.status === "bought");
  const totalCost = active.reduce((s, t) => s + t.targetPrice, 0);
  const totalSaved = active.reduce((s, t) => s + fundedOf(t), 0);
  const readyCount = active.filter((t) => t.status === "ready").length;

  const visible = useMemo(() => {
    const list = toBuy.filter((t) => (status === "archived" ? t.status === "archived" : status === "ready" ? t.status === "ready" : t.status === "saving" || t.status === "ready"));
    const sorted = [...list];
    if (sort === "manual") sorted.sort((a, b) => a.order - b.order);
    if (sort === "priority") sorted.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.order - b.order);
    if (sort === "progress") sorted.sort((a, b) => ratio(fundedOf(b), b.targetPrice) - ratio(fundedOf(a), a.targetPrice));
    if (sort === "date") sorted.sort((a, b) => (a.targetDate ?? "9999").localeCompare(b.targetDate ?? "9999"));
    return sorted;
  }, [toBuy, sort, status]);

  const actions: CardActions = {
    onAdd: (item) => setContrib({ item, mode: "add" }),
    onWithdraw: (item) => setContrib({ item, mode: "withdraw" }),
    onBought: (item) => setBuying(item),
    onHistory: (item) => setHistoryItem(item),
  };
  const canReorder = sort === "manual" && status === "active";

  return (
    <div>
      <PageHeader eyebrow="To-Buy" title="Things worth saving for">
        <Button onClick={() => openToBuy()}>+ New item</Button>
      </PageHeader>

      <Card className="mb-8 grid grid-cols-2 items-center gap-5 md:grid-cols-4">
        <div>
          <p className="eyebrow">Wishlist total</p>
          <p className="money mt-1 text-xl font-semibold">{formatMoney(totalCost)}</p>
        </div>
        <div>
          <p className="eyebrow">Set aside</p>
          <p className="mt-1 text-xl font-semibold text-savings">
            <NumberTicker value={totalSaved} />
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ProgressRing value={ratio(totalSaved, totalCost)} size={56} label="Wishlist funded">
            <span className="money text-xs font-semibold">{Math.round(ratio(totalSaved, totalCost) * 100)}%</span>
          </ProgressRing>
          <p className="text-sm text-muted">funded</p>
        </div>
        <div>
          <p className="eyebrow">Ready to buy</p>
          <p className="money mt-1 text-xl font-semibold">{readyCount}</p>
        </div>
      </Card>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <Tabs<StatusFilter>
          label="Status"
          idBase="tb-status"
          value={status}
          onChange={setStatus}
          tabs={[
            { value: "active", label: `Saving (${active.length})` },
            { value: "ready", label: `Ready (${readyCount})` },
            { value: "archived", label: "Archived" },
          ]}
        />
        <SegmentedControl<Sort>
          label="Sort"
          value={sort}
          onChange={setSort}
          layoutId="tb-sort"
          size="sm"
          options={[
            { value: "manual", label: "Manual" },
            { value: "priority", label: "Priority" },
            { value: "progress", label: "Progress" },
            { value: "date", label: "Target date" },
          ]}
        />
      </div>

      <TabPanel idBase="tb-status" value={status}>
      {visible.length === 0 ? (
        <EmptyState
          title={status === "archived" ? "Nothing archived" : "Your wishlist is empty"}
          body="Add something you're saving for. Set aside a little every payday and watch it fill up."
          action={status !== "archived" && <Button onClick={() => openToBuy()}>+ New item</Button>}
        />
      ) : canReorder ? (
        <Reorder.Group axis="y" values={visible.map((v) => v.id)} onReorder={reorderItems} className="mx-auto grid max-w-2xl gap-6">
          {visible.map((item) => (
            <ReorderRow key={item.id} item={item}>
              {(start) => <ItemCard item={item} bucket={buckets.get(item.bucketId)} actions={actions} dragHandle={start} confettiKey={confetti[item.id] ?? 0} />}
            </ReorderRow>
          ))}
        </Reorder.Group>
      ) : (
        <motion.div layout className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence>
            {visible.map((item) => (
              <motion.div key={item.id} layout initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}>
                <ItemCard item={item} bucket={buckets.get(item.bucketId)} actions={actions} confettiKey={confetti[item.id] ?? 0} />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}
      </TabPanel>

      {bought.length > 0 && (
        <section className="mt-12">
          <button type="button" onClick={() => setShowBought((v) => !v)} aria-expanded={showBought} className="flex min-h-11 items-center gap-2 text-sm font-medium">
            <motion.span animate={{ rotate: showBought ? 0 : -90 }}>
              <ChevronDown className="size-4" />
            </motion.span>
            Bought ({bought.length})
          </button>
          {showBought && (
            <ul className="card mt-3 divide-y divide-line p-0">
              {bought.map((t) => {
                const diff = (t.purchase?.actualPrice ?? 0) - t.targetPrice;
                return (
                  <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm md:px-5">
                    <span className="min-w-0">
                      <span className="block truncate font-medium line-through decoration-highlight decoration-2">{t.name}</span>
                      <span className="text-xs text-muted">{t.purchase && longDate(t.purchase.date)}</span>
                    </span>
                    <span className="money text-right text-xs">
                      <span className="block text-muted">target {formatMoney(t.targetPrice)}</span>
                      <span className={diff > 0 ? "text-danger" : "text-success"}>
                        paid {formatMoney(t.purchase?.actualPrice ?? 0)} ({diff > 0 ? "▲ +" : "▼ "}
                        {formatMoney(Math.abs(diff))})
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {contrib && <ContributionDialog item={contrib.item} mode={contrib.mode} onClose={() => setContrib(null)} onFunded={() => burst(contrib.item.id)} />}
      {buying && <BoughtDialog item={buying} onClose={() => setBuying(null)} onBought={() => setPageBurst((n) => n + 1)} />}
      <HistoryDrawer item={historyItem} onClose={() => setHistoryItem(null)} />
      <div aria-hidden className="pointer-events-none fixed inset-0 z-[85]">
        <PaperConfetti fire={pageBurst} />
      </div>
    </div>
  );
}
