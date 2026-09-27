import { motion } from "motion/react";
import { useReduced } from "@/hooks/useMedia";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";
import type { Centavos } from "@/domain/types";

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

function Digit({ d }: { d: number }) {
  return (
    <span className="relative inline-block h-[1em] overflow-hidden leading-none" style={{ width: "1ch" }}>
      <motion.span
        className="absolute left-0 top-0 flex flex-col"
        initial={false}
        animate={{ y: `${-d * 10}%` }}
        transition={{ type: "spring", stiffness: 260, damping: 28 }}
      >
        {DIGITS.map((n) => (
          <span key={n} className="block h-[1em] leading-none">
            {n}
          </span>
        ))}
      </motion.span>
    </span>
  );
}

/** Odometer-style money display. Digits roll when the value changes. */
export function NumberTicker({
  value,
  className,
  format = formatMoney,
  live = false,
}: {
  value: Centavos;
  className?: string;
  format?: (c: Centavos) => string;
  live?: boolean;
}) {
  const reduced = useReduced();
  const text = format(value);
  // Key characters from the right so the ones place stays in the same column as the number grows.
  const chars = [...text];
  return (
    <span className={cn("money inline-flex items-baseline", className)} aria-live={live ? "polite" : undefined}>
      <span className="sr-only">{text}</span>
      <span aria-hidden className="inline-flex leading-none">
        {chars.map((ch, i) => {
          const key = chars.length - i;
          if (!reduced && /\d/.test(ch)) return <Digit key={key} d={Number(ch)} />;
          return (
            <span key={`${key}-${ch}`} className="inline-block leading-none">
              {ch}
            </span>
          );
        })}
      </span>
    </span>
  );
}
