import { motion } from "motion/react";
import type { CSSProperties, ReactNode } from "react";
import { useReduced } from "@/hooks/useMedia";
import { cn } from "@/lib/cn";
import { seeded } from "@/lib/ids";

/** Strip of semi-transparent masking tape. */
export function Tape({ seed = "tape", className, style }: { seed?: string; className?: string; style?: CSSProperties }) {
  const rot = -2 + (seeded(seed) + 1) * 2.5; // −2°..3°
  return <span aria-hidden className={cn("tape pointer-events-none absolute block h-6 w-20", className)} style={{ rotate: `${rot}deg`, ...style }} />;
}

/** Section label held on by tape. */
export function TapeLabel({ children, seed, className }: { children: ReactNode; seed?: string; className?: string }) {
  const rot = -2 + (seeded(seed ?? String(children)) + 1) * 1.5;
  return (
    <span className={cn("tape inline-block px-3 py-1 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-ink", className)} style={{ rotate: `${rot}deg` }}>
      {children}
    </span>
  );
}

/** Embossed label-maker tag (bucket names, "Editing" markers). */
export function LabelTag({ children, color, className }: { children: ReactNode; color?: string; className?: string }) {
  return (
    <span className={cn("label-tag inline-flex h-6 items-center gap-1.5 rounded-[3px] px-2 text-[10.5px] leading-none font-semibold", className)}>
      {color && <span aria-hidden className="size-2 rounded-full" style={{ background: color }} />}
      {children}
    </span>
  );
}

/** Die-cut sticker chip. Rotation is seeded by id so it stays put between renders. */
export function Sticker({
  id,
  children,
  selected,
  onClick,
  className,
  as = "button",
  ...rest
}: {
  id: string;
  children: ReactNode;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
  as?: "button" | "span";
  "aria-label"?: string;
  "aria-pressed"?: boolean;
}) {
  const reduced = useReduced();
  const rot = seeded(id) * 3;
  const common = cn(
    "sticker inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-[box-shadow] duration-200",
    selected && "ring-2 ring-ink ring-offset-2 ring-offset-[var(--sticker-edge)]",
    className,
  );
  if (as === "span")
    return (
      <span className={cn(common, "min-h-8 px-2.5 text-xs")} style={{ rotate: `${rot}deg` }}>
        {children}
      </span>
    );
  return (
    <motion.button
      type="button"
      onClick={onClick}
      className={common}
      style={{ rotate: rot }}
      whileHover={reduced ? undefined : { y: -2, rotate: rot * 0.3, scale: 1.03 }}
      whileTap={reduced ? undefined : { scale: 0.96 }}
      transition={{ type: "spring", stiffness: 500, damping: 25 }}
      {...rest}
    >
      {children}
    </motion.button>
  );
}

// [left %, top %, size px] ink droplets flicked off the stamp on impact.
const SPLATTER: [number, number, number][] = [
  [-8, 20, 5], [104, 30, 4], [96, -14, 6], [-4, 96, 4], [48, 118, 3], [112, 88, 5], [20, -18, 3], [70, 112, 4],
];

/** Rubber stamp that slams onto the receipt when a cutoff is saved. */
export function Stamp({ label = "PAID ✓", sub, className }: { label?: string; sub?: string; className?: string }) {
  const reduced = useReduced();
  return (
    <motion.div
      aria-hidden
      initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 1.8, rotate: -24 }}
      animate={reduced ? { opacity: 0.9 } : { opacity: 0.9, scale: 1, rotate: -12 }}
      exit={{ opacity: 0, transition: { duration: 0.5 } }}
      transition={{ type: "spring", stiffness: 380, damping: 18 }}
      className={cn("stamp-ink pointer-events-none absolute z-10 select-none rounded-lg border-[3px] border-danger px-4 py-1.5 text-center text-danger", className)}
    >
      <div className="font-mono text-2xl font-bold tracking-[0.18em]">{label}</div>
      {sub && <div className="font-mono text-[10px] tracking-[0.2em]">{sub}</div>}
      {!reduced &&
        SPLATTER.map(([x, y, r], i) => (
          <motion.span
            key={i}
            className="absolute rounded-full bg-danger"
            style={{ left: `${x}%`, top: `${y}%`, width: r, height: r }}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: [0, 0.75, 0], scale: [0, 1.2, 1] }}
            transition={{ duration: 1.1, delay: 0.12 + i * 0.02, times: [0, 0.2, 1] }}
          />
        ))}
    </motion.div>
  );
}

const STROKES = {
  underline: { viewBox: "0 0 200 14", d: "M3 9 C 40 3, 80 12, 120 7 S 180 4, 197 8" },
  circle: { viewBox: "0 0 200 80", d: "M150 10 C 190 18, 198 55, 140 70 C 80 84, 12 72, 8 42 C 4 12, 70 4, 118 6 C 140 7, 160 12, 168 18" },
  arrow: { viewBox: "0 0 80 50", d: "M4 8 C 20 40, 45 44, 70 38 M58 30 L71 38 L60 47" },
} as const;

/** Hand-drawn SVG stroke that draws itself in. */
export function HandStroke({
  kind = "underline",
  className,
  color = "var(--highlight)",
  delay = 0.3,
  width = 3,
}: {
  kind?: keyof typeof STROKES;
  className?: string;
  color?: string;
  delay?: number;
  width?: number;
}) {
  const reduced = useReduced();
  const s = STROKES[kind];
  return (
    <svg aria-hidden viewBox={s.viewBox} fill="none" className={cn("pointer-events-none overflow-visible", className)} preserveAspectRatio="none">
      <motion.path
        d={s.d}
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        initial={reduced ? { pathLength: 1, opacity: 0 } : { pathLength: 0, opacity: 1 }}
        whileInView={{ pathLength: 1, opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: reduced ? 0.2 : 0.6, delay, ease: [0.65, 0, 0.35, 1] }}
      />
    </svg>
  );
}

/** Handwritten margin note (max one per screen). */
export function MarginNote({ children, className, arrow = "left" }: { children: ReactNode; className?: string; arrow?: "left" | "down" | "none" }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6, duration: 0.4 }}
      className={cn("pointer-events-none flex items-center gap-1 font-hand text-xl leading-none text-muted", className)}
    >
      {arrow === "left" && <HandStroke kind="arrow" className="h-6 w-10 -scale-x-100" color="var(--muted)" width={2} delay={0.8} />}
      <span className="-rotate-2">{children}</span>
      {arrow === "down" && <HandStroke kind="arrow" className="h-7 w-10 rotate-45" color="var(--muted)" width={2} delay={0.8} />}
    </motion.div>
  );
}
