import { ChevronLeft, ChevronRight } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { useState } from "react";
import { BlurHeading } from "@/components/ui/misc";
import { cn } from "@/lib/cn";
import { cutoffLabel, nextCutoffId, periodOf, prevCutoffId, todayISO } from "@/lib/periods";
import { useStore } from "@/store/useStore";

/** ◀ Sep 2026 · 15th ▶ — shared across Payday, Expenses, Insights. */
export function PeriodSwitcher({ className }: { className?: string }) {
  const period = useStore((s) => s.ui.period);
  const setPeriod = useStore((s) => s.setPeriod);
  const paydays = useStore((s) => s.settings.paydays);
  const current = periodOf(todayISO(), paydays);
  const [dir, setDir] = useState(1);
  const go = (id: string, d: number) => {
    setDir(d);
    setPeriod(id);
  };
  return (
    <div className={cn("inline-flex items-center gap-1 rounded-full bg-surface-2 p-1", className)} role="group" aria-label="Pay period">
      <button type="button" aria-label="Previous cutoff" onClick={() => go(prevCutoffId(period), -1)} className="grid size-10 place-items-center rounded-full text-muted hover:bg-surface hover:text-ink">
        <ChevronLeft className="size-4" />
      </button>
      <div className="relative min-w-[11.5rem] overflow-hidden text-center">
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <m.span
            key={period}
            custom={dir}
            initial={{ opacity: 0, x: dir * 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -16 }}
            transition={{ duration: 0.18 }}
            className="money block whitespace-nowrap text-sm font-medium"
            aria-live="polite"
          >
            {cutoffLabel(period, paydays)}
          </m.span>
        </AnimatePresence>
      </div>
      <button type="button" aria-label="Next cutoff" onClick={() => go(nextCutoffId(period), 1)} className="grid size-10 place-items-center rounded-full text-muted hover:bg-surface hover:text-ink">
        <ChevronRight className="size-4" />
      </button>
      {period !== current && (
        <button type="button" onClick={() => go(current, period < current ? 1 : -1)} className="min-h-10 rounded-full px-3 text-xs font-medium text-ink hover:bg-surface">
          Today
        </button>
      )}
    </div>
  );
}

export function PageHeader({ eyebrow, title, children }: { eyebrow?: string; title: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:mb-8 md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        {typeof title === "string" ? <BlurHeading text={title} className="text-4xl leading-none md:text-5xl" /> : title}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
