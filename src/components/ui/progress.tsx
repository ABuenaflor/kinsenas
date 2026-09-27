import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useReduced } from "@/hooks/useMedia";
import { cn } from "@/lib/cn";
import { mulberry32 } from "@/lib/rng";

/** Horizontal bar; values > 1 extend with a hatched overspend segment. */
export function ProgressBar({
  value,
  color = "var(--ink)",
  className,
  label,
  track = true,
}: {
  value: number; // 0..∞ (ratio)
  color?: string;
  className?: string;
  label: string;
  track?: boolean;
}) {
  const clamped = Math.max(0, Math.min(1, value));
  const over = value > 1;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
      aria-valuetext={`${Math.round(value * 100)}%${over ? " (over)" : ""}`}
      className={cn("relative h-2.5 w-full overflow-hidden rounded-full", track && "bg-surface-2", className)}
    >
      <motion.div
        className={cn("absolute inset-y-0 left-0 w-full origin-left rounded-full", over && "hatch")}
        style={over ? undefined : { background: color }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: clamped }}
        transition={{ type: "spring", stiffness: 220, damping: 26 }}
      />
    </div>
  );
}

export function ProgressRing({
  value,
  size = 56,
  stroke = 6,
  color = "var(--savings)",
  label,
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  label: string;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div
      className="relative inline-grid shrink-0 place-items-center"
      style={{ width: size, height: size }}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v * 100)}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: v }}
          transition={{ type: "spring", stiffness: 220, damping: 26 }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

const SCRAP_COLORS = ["var(--highlight)", "var(--savings)", "var(--essentials)", "var(--wants)", "var(--swatch-3)", "var(--swatch-6)"];

/** Burst of paper scraps (≤ 24). Fires whenever `fire` increments. */
export function PaperConfetti({ fire }: { fire: number }) {
  const reduced = useReduced();
  const [bursts, setBursts] = useState<number[]>([]);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (reduced || fire === 0) return;
    setBursts((b) => [...b, fire]);
    const t = setTimeout(() => setBursts((b) => b.filter((x) => x !== fire)), 1400);
    return () => clearTimeout(t);
  }, [fire, reduced]);
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-visible">
      <AnimatePresence>
        {bursts.map((b) => {
          const rng = mulberry32(b * 7919);
          return (
            <div key={b} className="absolute left-1/2 top-1/3">
              {Array.from({ length: 22 }, (_, i) => {
                const angle = rng() * Math.PI * 2;
                const dist = 60 + rng() * 110;
                return (
                  <motion.span
                    key={i}
                    className="absolute block"
                    style={{
                      width: 6 + rng() * 6,
                      height: 4 + rng() * 8,
                      background: SCRAP_COLORS[i % SCRAP_COLORS.length],
                      clipPath: "polygon(0 10%, 100% 0, 90% 100%, 5% 85%)",
                    }}
                    initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
                    animate={{
                      x: Math.cos(angle) * dist,
                      y: [0, Math.sin(angle) * dist - 40, Math.sin(angle) * dist + 80],
                      opacity: [1, 1, 0],
                      rotate: (rng() - 0.5) * 720,
                    }}
                    transition={{ duration: 1.1 + rng() * 0.3, ease: "easeOut" }}
                  />
                );
              })}
            </div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
