import { motion } from "motion/react";
import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { cn } from "@/lib/cn";
import { formatBps } from "@/lib/money";
import type { Bps } from "@/domain/types";

export interface SplitSegment {
  id: string;
  label: string;
  color: string;
  percent: Bps;
}

/**
 * Draggable allocation bar. Handles sit between segments; dragging a handle moves
 * percent between its two neighbours. Keyboard: ←/→ ±1%, Shift ±5%.
 */
export function SplitBar({
  segments,
  onChange,
  className,
}: {
  segments: SplitSegment[];
  onChange: (percents: Bps[]) => void;
  className?: string;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const total = segments.reduce((s, x) => s + x.percent, 0);
  const scale = Math.max(total, 10000);

  const moveBoundary = (i: number, deltaOrAbs: { delta?: Bps; abs?: Bps }) => {
    const a = segments[i];
    const b = segments[i + 1];
    if (!a || !b) return;
    const before = segments.slice(0, i).reduce((s, x) => s + x.percent, 0);
    const pairTotal = a.percent + b.percent;
    let newA = deltaOrAbs.abs !== undefined ? deltaOrAbs.abs - before : a.percent + (deltaOrAbs.delta ?? 0);
    newA = Math.max(0, Math.min(pairTotal, newA));
    const next = segments.map((s) => s.percent);
    next[i] = newA;
    next[i + 1] = pairTotal - newA;
    onChange(next);
  };

  const onPointer = (e: PointerEvent, i: number) => {
    const bar = barRef.current;
    if (!bar) return;
    const r = bar.getBoundingClientRect();
    const raw = ((e.clientX - r.left) / r.width) * scale;
    moveBoundary(i, { abs: Math.round(raw / 100) * 100 });
  };

  const onKey = (e: KeyboardEvent, i: number) => {
    const step = e.shiftKey ? 500 : 100;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") moveBoundary(i, { delta: step });
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") moveBoundary(i, { delta: -step });
    else return;
    e.preventDefault();
  };

  // Cumulative percent at each handle (between segment i and i + 1).
  const boundaries = segments.slice(0, -1).map((_, i) => segments.slice(0, i + 1).reduce((s, x) => s + x.percent, 0));
  return (
    <div className={cn("select-none", className)}>
      <div ref={barRef} className="relative flex h-14 w-full overflow-visible rounded-md bg-surface-2">
        {segments.map((s, i) => {
          const width = (s.percent / scale) * 100;
          return (
            <motion.div
              key={s.id}
              layout
              transition={{ type: "spring", stiffness: 500, damping: 40 }}
              className={cn("relative flex h-full min-w-0 items-center justify-center overflow-hidden text-white", i === 0 && "rounded-l-md", i === segments.length - 1 && total >= 10000 && "rounded-r-md")}
              style={{ width: `${width}%`, background: s.color }}
            >
              {width > 9 && (
                <span className="money truncate px-1 text-xs font-semibold drop-shadow-[0_1px_0_rgb(0_0_0/0.25)]">{formatBps(s.percent)}</span>
              )}
            </motion.div>
          );
        })}
        {segments.slice(0, -1).map((s, i) => {
          const cum = boundaries[i] ?? 0;
          const left = (cum / scale) * 100;
          const next = segments[i + 1];
          return (
            <div
              key={`h-${s.id}`}
              role="slider"
              tabIndex={0}
              aria-label={`Split between ${s.label} and ${next?.label ?? ""}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(cum / 100)}
              aria-valuetext={`${s.label} ${formatBps(s.percent)}, ${next?.label ?? ""} ${formatBps(next?.percent ?? 0)}`}
              onKeyDown={(e) => onKey(e, i)}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                setDragging(i);
              }}
              onPointerMove={(e) => dragging === i && onPointer(e, i)}
              onPointerUp={() => setDragging(null)}
              onPointerCancel={() => setDragging(null)}
              className="absolute top-1/2 z-10 grid h-16 w-11 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize touch-none place-items-center"
              style={{ left: `${left}%` }}
            >
              <motion.span
                animate={{ scale: dragging === i ? 1.15 : 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 18 }}
                className="flex h-10 w-3 items-center justify-center rounded-full border-2 border-surface bg-ink shadow-md"
              >
                <span className="h-4 w-px bg-surface/70" />
              </motion.span>
            </div>
          );
        })}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {segments.map((s) => (
          <li key={s.id} className="flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-full" style={{ background: s.color }} />
            <span className="text-muted">{s.label}</span>
            <span className="money font-medium">{formatBps(s.percent)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** "100% allocated ✓" / "12% left to assign" meter. */
export function AllocationMeter({ total }: { total: Bps }) {
  const ok = total === 10000;
  const diff = 10000 - total;
  return (
    <p role="status" className={cn("money text-sm font-medium", ok ? "text-success" : "text-danger")}>
      {ok ? "100% allocated ✓" : diff > 0 ? `${formatBps(diff)} left to assign` : `${formatBps(-diff)} over — trim a share`}
    </p>
  );
}
