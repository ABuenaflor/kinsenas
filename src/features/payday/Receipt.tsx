import { AnimatePresence, m } from "motion/react";
import type { ReactNode } from "react";
import { HandStroke } from "@/components/ui/diy";
import { NumberTicker } from "@/components/ui/NumberTicker";
import { useReduced } from "@/hooks/useMedia";
import { cn } from "@/lib/cn";
import { formatBps, formatMoney, ratio } from "@/lib/money";
import type { AllocationLine, Centavos, DeductionLine } from "@/domain/types";

export interface ReceiptProps {
  title: string;
  subtitle?: string;
  gross: Centavos;
  deductions: DeductionLine[];
  net: Centavos;
  allocations: AllocationLine[];
  setAsides?: { name: string; amount: Centavos }[];
  govAlreadyDeducted?: boolean;
  printKey?: string | number;
  animate?: boolean;
  overlay?: ReactNode;
  circleNet?: boolean; // hand-drawn circle around Net pay (after saving)
  className?: string;
}

function Row({ label, value, strong, muted, swatch, extra }: { label: ReactNode; value: string; strong?: boolean; muted?: boolean; swatch?: string; extra?: string }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3 py-1", strong && "font-semibold", muted && "text-muted")}>
      <span className="flex min-w-0 items-center gap-2">
        {swatch && <span aria-hidden className="size-2.5 shrink-0 rounded-[2px]" style={{ background: swatch }} />}
        <span className="truncate">{label}</span>
        {extra && <span className="text-muted">{extra}</span>}
      </span>
      <span className="shrink-0 tabular-nums">{value}</span>
    </div>
  );
}

/** Thermal-receipt breakdown: gross → deductions → net → allocations. */
export function Receipt({
  title,
  subtitle,
  gross,
  deductions,
  net,
  allocations,
  setAsides = [],
  govAlreadyDeducted,
  printKey = 0,
  animate = true,
  overlay,
  circleNet,
  className,
}: ReceiptProps) {
  const reduced = useReduced();
  const lineAnim = animate && !reduced;
  const item = {
    hidden: lineAnim ? { opacity: 0, y: -4, clipPath: "inset(0 0 100% 0)" } : { opacity: 1 },
    show: { opacity: 1, y: 0, clipPath: "inset(0 0 0% 0)", transition: { duration: 0.2 } },
  };
  const negative = net < 0;

  return (
    <div className={cn("receipt relative rounded-t-md px-5 pt-5 font-mono text-[13px] leading-snug text-ink md:px-6", className)}>
      {overlay}
      <div className="text-center">
        <p className="text-[11px] tracking-[0.3em] text-muted">* * * KINSENAS * * *</p>
        <p className="mt-1 text-sm font-semibold uppercase tracking-[0.12em]">{title}</p>
        {subtitle && <p className="text-[11px] text-muted">{subtitle}</p>}
      </div>
      <hr className="dash my-3" />
      <m.div key={printKey} initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.04 } } }}>
        <m.div variants={item}>
          <Row label="GROSS PAY" value={formatMoney(gross)} strong />
        </m.div>
        {govAlreadyDeducted && (
          <m.p variants={item} className="py-1 text-[11px] text-muted">
            Gov't contributions & tax already deducted by employer.
          </m.p>
        )}
        {deductions.map((d) => (
          <m.div key={d.key} variants={item}>
            <Row label={d.label} value={`−${formatMoney(d.amount)}`} muted={d.amount === 0} />
          </m.div>
        ))}
        <m.hr variants={item} className="dash my-2" />
        <m.div variants={item} className="flex items-baseline justify-between py-1">
          <span className="text-sm font-bold tracking-[0.1em]">NET PAY</span>
          <span className={cn("relative text-2xl font-semibold", negative && "text-danger")}>
            <NumberTicker value={net} live />
            {circleNet && <HandStroke kind="circle" className="absolute -inset-x-4 -inset-y-3 h-[calc(100%+24px)] w-[calc(100%+32px)]" color="var(--danger)" width={2} delay={0.35} />}
          </span>
        </m.div>
        <AnimatePresence>
          {negative && (
            <m.p
              role="alert"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mt-1 rounded-sm bg-danger/10 px-2 py-1.5 font-sans text-xs text-danger"
            >
              Deductions are bigger than gross this cutoff. Allocations are set to ₱0.00 — you can still save.
            </m.p>
          )}
        </AnimatePresence>
        <m.hr variants={item} className="dash my-2" />
        <m.p variants={item} className="pb-1 text-[11px] tracking-[0.2em] text-muted">
          ALLOCATION
        </m.p>
        {allocations.map((a) => (
          <m.div key={a.bucketId} variants={item}>
            <Row label={a.name} swatch={a.color} value={formatMoney(a.amount)} extra={net > 0 ? formatBps(Math.round(ratio(a.amount, net) * 10000)) : undefined} />
          </m.div>
        ))}
        {setAsides.length > 0 && (
          <>
            <m.hr variants={item} className="dash my-2" />
            <m.p variants={item} className="pb-1 text-[11px] tracking-[0.2em] text-muted">
              SET ASIDE FOR TO-BUY
            </m.p>
            {setAsides.map((s, i) => (
              <m.div key={`${s.name}-${i}`} variants={item}>
                <Row label={`↳ ${s.name}`} value={formatMoney(s.amount)} muted />
              </m.div>
            ))}
          </>
        )}
      </m.div>
      <hr className="dash my-3" />
      <p className="text-center text-[10.5px] leading-relaxed text-muted">
        Estimates only. Your employer's payroll is the official computation.
      </p>
      <p aria-hidden className="mt-2 text-center text-[10px] tracking-[0.4em] text-muted">
        ||| || ||| | |||| || |
      </p>
    </div>
  );
}
