import { motion } from "motion/react";
import { cn } from "@/lib/cn";
import { formatBps, formatMoney } from "@/lib/money";
import type { Centavos } from "@/domain/types";
import { LabelTag } from "./diy";
import { NumberTicker } from "./NumberTicker";

/** Cash envelope for a bucket; the fill rises to `fill` (0..1). */
export function Envelope({
  name,
  color,
  amount,
  fill,
  share,
  caption,
  className,
}: {
  name: string;
  color: string;
  amount: Centavos;
  fill: number;
  share?: number; // bps of net
  caption?: string;
  className?: string;
}) {
  const f = Math.max(0, Math.min(1, fill));
  return (
    <div className={cn("card relative overflow-hidden p-0", className)}>
      <motion.div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-full origin-bottom"
        style={{ background: `color-mix(in oklab, ${color} 16%, transparent)` }}
        initial={{ scaleY: 0 }}
        animate={{ scaleY: f }}
        transition={{ type: "spring", stiffness: 160, damping: 24 }}
      />
      <svg aria-hidden viewBox="0 0 200 40" preserveAspectRatio="none" className="relative block h-8 w-full">
        <path d="M0 0 L100 34 L200 0" fill="none" stroke="var(--line)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="relative px-4 pb-4">
        <div className="flex items-center justify-between gap-2">
          <LabelTag color={color}>{name}</LabelTag>
          {share !== undefined && <span className="money text-xs text-muted">{formatBps(share)}</span>}
        </div>
        <div className="mt-3 text-xl font-semibold md:text-2xl" title={formatMoney(amount)}>
          <NumberTicker value={amount} />
        </div>
        {caption && <p className="mt-0.5 text-xs text-muted">{caption}</p>}
      </div>
      <span aria-hidden className="absolute bottom-0 left-0 h-1 w-full" style={{ background: color }} />
    </div>
  );
}
