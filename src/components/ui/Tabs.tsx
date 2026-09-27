import { m } from "motion/react";
import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface TabDef<T extends string> {
  value: T;
  label: ReactNode;
}

/** Tab strip with an animated underline; pair with <TabPanel>. Arrow keys / Home / End move between tabs. */
export function Tabs<T extends string>({
  value,
  onChange,
  tabs,
  label,
  idBase,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  tabs: readonly TabDef<T>[];
  label: string;
  idBase: string;
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const underline = useId();
  const onKey = (e: KeyboardEvent, i: number) => {
    let next = -1;
    if (e.key === "ArrowRight") next = (i + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    if (next < 0) return;
    e.preventDefault();
    const t = tabs[next];
    if (t) {
      onChange(t.value);
      refs.current[next]?.focus();
    }
  };
  return (
    <div role="tablist" aria-label={label} className={cn("flex gap-1 border-b border-line", className)}>
      {tabs.map((t, i) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            id={`${idBase}-tab-${t.value}`}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={`${idBase}-panel`}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.value)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn("relative min-h-11 px-3 text-sm font-medium transition-colors", active ? "text-ink" : "text-muted hover:text-ink")}
          >
            {t.label}
            {active && (
              <m.span layoutId={underline} className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-ink" transition={{ type: "spring", stiffness: 500, damping: 38 }} />
            )}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({ idBase, value, children, className }: { idBase: string; value: string; children: ReactNode; className?: string }) {
  return (
    <div role="tabpanel" id={`${idBase}-panel`} aria-labelledby={`${idBase}-tab-${value}`} className={className}>
      {children}
    </div>
  );
}
