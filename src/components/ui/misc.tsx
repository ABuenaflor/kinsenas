import { m } from "motion/react";
import type { ReactNode } from "react";
import { useReduced } from "@/hooks/useMedia";
import { cn } from "@/lib/cn";

/** Word-by-word blur-in heading on first view. */
export function BlurHeading({ text, className, as: Tag = "h1" }: { text: string; className?: string; as?: "h1" | "h2" }) {
  const reduced = useReduced();
  const words = text.split(" ");
  const MotionTag = Tag === "h1" ? m.h1 : m.h2;
  return (
    <MotionTag
      className={cn("font-display leading-[1.05] tracking-tight", className)}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true }}
      transition={{ staggerChildren: 0.05 }}
      aria-label={text}
    >
      {words.map((w, i) => (
        <m.span
          key={`${w}-${i}`}
          aria-hidden
          className="inline-block whitespace-pre"
          variants={
            reduced
              ? { hidden: { opacity: 1 }, show: { opacity: 1 } }
              : // Starts faint-but-visible (not opacity 0) so the heading paints right away and counts for LCP.
                { hidden: { opacity: 0.3, filter: "blur(8px)", y: 8 }, show: { opacity: 1, filter: "blur(0px)", y: 0 } }
          }
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          {w}
          {i < words.length - 1 ? " " : ""}
        </m.span>
      ))}
    </MotionTag>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-md bg-surface-2", className)} />;
}

export function PageSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-12 w-64" />
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
      <Skeleton className="h-72" />
    </div>
  );
}

export function KeyboardHint({ keys, className }: { keys: string[]; className?: string }) {
  return (
    <span className={cn("hidden items-center gap-0.5 md:inline-flex", className)} aria-hidden>
      {keys.map((k) => (
        <kbd key={k} className="money min-w-5 rounded border border-line bg-surface-2 px-1 text-center text-[11px] leading-5 text-muted">
          {k}
        </kbd>
      ))}
    </span>
  );
}

export function Tooltip({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <span className={cn("group/tt relative inline-flex", className)}>
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-accent px-2 py-1 text-xs text-accent-ink opacity-0 transition-opacity duration-150 group-hover/tt:opacity-100 group-focus-within/tt:opacity-100"
      >
        {label}
      </span>
    </span>
  );
}

/** DIY doodle: a hand-drawn envelope with a coin. */
function Doodle() {
  return (
    <svg viewBox="0 0 160 110" className="h-28 w-40 text-muted" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 38 L80 30 L140 40 L136 96 L24 100 Z" />
      <path d="M22 38 L80 70 L140 40" />
      <path d="M24 100 L66 64 M136 96 L96 62" strokeDasharray="3 5" />
      <circle cx="118" cy="22" r="13" fill="var(--highlight)" stroke="currentColor" />
      <path d="M114 18 h6 a3 3 0 0 1 0 6 h-6 v6 M112 21 h11" strokeWidth="1.6" />
      <path d="M10 60 q6 -4 10 0 M142 70 q6 -5 12 -1" />
    </svg>
  );
}

export function EmptyState({ title, body, action, className }: { title: string; body?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 rounded-lg border-[1.5px] border-dashed border-line px-6 py-10 text-center", className)}>
      <Doodle />
      <h3 className="font-display text-2xl">{title}</h3>
      {body && <p className="max-w-sm text-sm text-muted">{body}</p>}
      {action && <div className="mt-2 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}
