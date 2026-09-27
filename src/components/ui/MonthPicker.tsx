import { AnimatePresence, motion } from "motion/react";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";
import { MONTHS, monthLabel, pad2 } from "@/lib/periods";

/**
 * Simple month-grid date picker ("YYYY-MM"). A button opens a popover with a year
 * switcher and a 4×3 month grid; arrow keys move, Enter picks, Esc closes.
 */
export function MonthPicker({
  value,
  onChange,
  label,
  placeholder = "Pick a month",
  min,
  max,
  clearable,
  className,
  id,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  label: string;
  placeholder?: string;
  min?: string;
  max?: string;
  clearable?: boolean;
  className?: string;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const fallbackYear = Number((value ?? max ?? min ?? new Date().toISOString()).slice(0, 4));
  const [year, setYear] = useState(fallbackYear);
  const [focusIdx, setFocusIdx] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const cells = useRef<(HTMLButtonElement | null)[]>([]);
  const gridId = useId();

  const openPicker = () => {
    const y = Number((value ?? "").slice(0, 4)) || fallbackYear;
    setYear(y);
    setFocusIdx(value ? Number(value.slice(5, 7)) - 1 : 0);
    setOpen(true);
  };
  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    cells.current[focusIdx]?.focus();
  }, [open, focusIdx, year]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const keyOf = (i: number) => `${year}-${pad2(i + 1)}`;
  const disabled = (i: number) => (!!min && keyOf(i) < min) || (!!max && keyOf(i) > max);
  const pick = (i: number) => {
    if (disabled(i)) return;
    onChange(keyOf(i));
    close();
  };
  const onGridKey = (e: KeyboardEvent) => {
    const moves: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 3, ArrowUp: -3 };
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
      return;
    }
    if (e.key === "PageUp" || e.key === "PageDown") {
      e.preventDefault();
      setYear((y) => y + (e.key === "PageUp" ? -1 : 1));
      return;
    }
    const d = moves[e.key];
    if (d === undefined) return;
    e.preventDefault();
    let next = focusIdx + d;
    if (next < 0) {
      setYear((y) => y - 1);
      next += 12;
    } else if (next > 11) {
      setYear((y) => y + 1);
      next -= 12;
    }
    setFocusIdx(next);
  };

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <div className="field flex items-center gap-1 pr-1">
        <button
          ref={buttonRef}
          id={id}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={`${label}: ${value ? monthLabel(value, true) : "not set"}`}
          onClick={() => (open ? close() : openPicker())}
          className="flex min-h-11 flex-1 items-center gap-2 text-left"
        >
          <CalendarDays className="size-4 text-muted" aria-hidden />
          <span className={cn("whitespace-nowrap", !value && "text-muted")}>{value ? monthLabel(value, true) : placeholder}</span>
        </button>
        {clearable && value && (
          <button type="button" aria-label={`Clear ${label}`} onClick={() => onChange(null)} className="grid size-9 place-items-center rounded-md text-muted hover:bg-surface hover:text-ink">
            <X className="size-4" />
          </button>
        )}
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label={`Choose ${label.toLowerCase()}`}
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, transition: { duration: 0.12 } }}
            transition={{ type: "spring", stiffness: 520, damping: 36 }}
            className="card absolute left-0 top-full z-50 mt-2 w-72 p-3 shadow-drawer"
          >
            <div className="mb-2 flex items-center justify-between">
              <button type="button" aria-label="Previous year" onClick={() => setYear((y) => y - 1)} className="grid size-10 place-items-center rounded-md hover:bg-surface-2">
                <ChevronLeft className="size-4" />
              </button>
              <span className="money font-semibold" aria-live="polite">
                {year}
              </span>
              <button type="button" aria-label="Next year" onClick={() => setYear((y) => y + 1)} className="grid size-10 place-items-center rounded-md hover:bg-surface-2">
                <ChevronRight className="size-4" />
              </button>
            </div>
            {/* A group of toggle buttons with one roving tab stop; arrows move, PageUp/PageDown change year. */}
            <div id={gridId} role="group" aria-label={`${year} months`} className="grid grid-cols-3 gap-1">
              {MONTHS.map((m, i) => {
                const selected = value === keyOf(i);
                return (
                  <button
                    key={m}
                    ref={(el) => {
                      cells.current[i] = el;
                    }}
                    type="button"
                    aria-pressed={selected}
                    onKeyDown={onGridKey}
                    aria-label={`${m} ${year}`}
                    tabIndex={i === focusIdx ? 0 : -1}
                    disabled={disabled(i)}
                    onClick={() => pick(i)}
                    onFocus={() => setFocusIdx(i)}
                    className={cn(
                      "min-h-11 rounded-md text-sm transition-colors disabled:opacity-30",
                      selected ? "bg-accent font-semibold text-accent-ink" : "hover:bg-surface-2",
                    )}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
