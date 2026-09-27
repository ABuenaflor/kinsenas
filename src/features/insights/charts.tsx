import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Line,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AXIS, ChartCard, ChartDefs, ChartTooltip, GRID, Legend } from "@/components/charts/ChartBits";
import { SegmentedControl } from "@/components/ui/inputs";
import type { BucketTotals } from "@/domain/metrics";
import type { Category, Expense } from "@/domain/types";
import { cn } from "@/lib/cn";
import { formatCompact, formatMoney } from "@/lib/money";
import { lastDay, MONTHS, parseISODate, toISODate } from "@/lib/periods";
import type { SeriesPoint } from "./series";

const money = (v: unknown) => formatCompact(typeof v === "number" ? v : 0);
const H = 260;

/* 1. Monthly flow: Saved / Spent / Unspent bars + Net income line (one ₱ axis). */
export function MonthlyFlowChart({ data, animate }: { data: SeriesPoint[]; animate: boolean }) {
  const last = data[data.length - 1];
  const lastIdx = data.length - 1;
  // Direct labels only on the latest period (selective, never on every bar).
  const lastLabel = (props: { index?: number; x?: unknown; y?: unknown; width?: unknown; value?: unknown }) =>
    props.index === lastIdx ? (
      <text x={Number(props.x) + Number(props.width) / 2} y={Number(props.y) - 6} textAnchor="middle" fontSize={11} fill="var(--ink)" fontFamily="var(--font-mono)">
        {money(props.value)}
      </text>
    ) : null;
  return (
    <ChartCard
      eyebrow="Hero"
      title="Monthly flow"
      summary={last ? `Latest ${last.label}: net ${formatMoney(last.net)}, saved ${formatMoney(last.saved)}, spent ${formatMoney(last.spent)}, unspent ${formatMoney(last.unspent)}.` : "No data."}
      legend={
        <Legend
          items={[
            { label: "Saved", color: "var(--savings)" },
            { label: "Spent", color: "var(--wants)" },
            { label: "Unspent", color: "var(--essentials)" },
            { label: "Net income", color: "var(--ink)", line: true },
          ]}
        />
      }
      table={{ head: ["Period", "Net", "Saved", "Spent", "Unspent"], rows: data.map((d) => [d.label, formatMoney(d.net), formatMoney(d.saved), formatMoney(d.spent), formatMoney(d.unspent)]) }}
    >
      <ResponsiveContainer width="100%" height={H + 30}>
        <ComposedChart data={data} margin={{ top: 24, right: 8, left: 0, bottom: 0 }} barGap={2} barCategoryGap="22%">
          <CartesianGrid {...GRID} />
          <XAxis dataKey="label" {...AXIS} tickLine={false} />
          <YAxis {...AXIS} tickFormatter={money} width={56} tickLine={false} axisLine={false} />
          <Tooltip cursor={{ fill: "var(--surface-2)" }} content={(p) => <ChartTooltip active={p.active} payload={p.payload} label={p.label} />} />
          <Bar dataKey="saved" name="Saved" fill="var(--savings)" radius={[4, 4, 0, 0]} isAnimationActive={animate}>
            <LabelList dataKey="saved" content={lastLabel} />
          </Bar>
          <Bar dataKey="spent" name="Spent" fill="var(--wants)" radius={[4, 4, 0, 0]} isAnimationActive={animate}>
            <LabelList dataKey="spent" content={lastLabel} />
          </Bar>
          <Bar dataKey="unspent" name="Unspent" fill="var(--essentials)" radius={[4, 4, 0, 0]} isAnimationActive={animate} />
          <Line dataKey="net" name="Net income" type="monotone" stroke="var(--ink)" strokeWidth={2} dot={{ r: 4, fill: "var(--ink)", stroke: "var(--surface)", strokeWidth: 2 }} isAnimationActive={animate} />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

/* 2. Allocated vs spent by bucket: outline = allocated, fill = spent. */
export function AllocatedVsSpent({ buckets, monthLabelText }: { buckets: BucketTotals[]; monthLabelText: string }) {
  const rows = buckets.filter((b) => b.allocated > 0 || b.spent > 0);
  const max = Math.max(1, ...rows.map((b) => Math.max(b.allocated, b.spent)));
  return (
    <ChartCard
      title="Allocated vs spent"
      eyebrow={monthLabelText}
      summary={rows.map((b) => `${b.name}: allocated ${formatMoney(b.allocated)}, spent ${formatMoney(b.spent)}`).join("; ") || "No data."}
      legend={<Legend items={[{ label: "Allocated (outline)", color: "var(--line)" }, { label: "Spent (fill)", color: "var(--ink)" }]} />}
      table={{ head: ["Bucket", "Allocated", "Spent", "Remaining"], rows: rows.map((b) => [b.name, formatMoney(b.allocated), formatMoney(b.spent), formatMoney(b.remaining)]) }}
    >
      {rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">Nothing logged this month.</p>
      ) : (
        <ul className="space-y-4">
          {rows.map((b) => {
            const over = b.spent > b.allocated;
            return (
              <li key={b.bucketId}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="font-medium">{b.name}</span>
                  <span className={cn("money text-xs", over ? "text-danger" : "text-muted")}>
                    {formatMoney(b.spent)} / {formatMoney(b.allocated)} {over && "▲ over"}
                  </span>
                </div>
                <div className="relative h-5">
                  <div className="absolute inset-y-0 left-0 rounded-[4px] border-2" style={{ width: `${(b.allocated / max) * 100}%`, borderColor: b.color }} />
                  <div
                    className={cn("absolute inset-y-[5px] left-[5px] origin-left rounded-[3px] transition-transform duration-500", over && "hatch")}
                    style={{ width: `calc(${(b.spent / max) * 100}% - 10px)`, background: over ? undefined : b.color, minWidth: b.spent > 0 ? 3 : 0 }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </ChartCard>
  );
}

/* 3. Cumulative savings with a hand-written note on the best month. */
export function SavingsOverTime({ data, animate }: { data: SeriesPoint[]; animate: boolean }) {
  const best = data.reduce<SeriesPoint | undefined>((b, d) => (!b || d.saved > b.saved ? d : b), undefined);
  return (
    <ChartCard
      title="Savings over time"
      summary={`Cumulative saved reaches ${formatMoney(data[data.length - 1]?.cumulativeSaved ?? 0)}.${best ? ` Best period: ${best.label} with ${formatMoney(best.saved)}.` : ""}`}
      table={{ head: ["Period", "Saved", "Cumulative"], rows: data.map((d) => [d.label, formatMoney(d.saved), formatMoney(d.cumulativeSaved)]) }}
    >
      <ResponsiveContainer width="100%" height={H}>
        <AreaChart data={data} margin={{ top: 28, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="saved-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--savings)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--savings)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid {...GRID} />
          <XAxis dataKey="label" {...AXIS} tickLine={false} />
          <YAxis {...AXIS} tickFormatter={money} width={56} tickLine={false} axisLine={false} />
          <Tooltip content={(p) => <ChartTooltip active={p.active} payload={p.payload} label={p.label} />} cursor={{ stroke: "var(--muted)", strokeDasharray: "3 3" }} />
          <Area dataKey="cumulativeSaved" name="Cumulative saved" type="monotone" stroke="var(--savings)" strokeWidth={2} fill="url(#saved-fill)" isAnimationActive={animate} activeDot={{ r: 5, stroke: "var(--surface)", strokeWidth: 2 }} />
          {best && best.saved > 0 && (
            <ReferenceDot
              x={best.label}
              y={best.cumulativeSaved}
              r={6}
              fill="var(--highlight)"
              stroke="var(--ink)"
              strokeWidth={1.5}
              label={{ value: `best: +${formatCompact(best.saved)}`, position: "top", fill: "var(--muted)", fontSize: 18, fontFamily: "var(--font-hand)", offset: 12 }}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

/* 4. Where the gross went: deductions (hatched) + bucket allocations, absolute or 100%. */
export function WhereGrossWent({ data, bucketMeta, animate }: { data: SeriesPoint[]; bucketMeta: { id: string; name: string; color: string }[]; animate: boolean }) {
  const [mode, setMode] = useState<"abs" | "pct">("abs");
  const rows = data.map((d) => {
    const row: Record<string, number | string> = { label: d.label, deductions: d.deductions };
    for (const b of bucketMeta) row[b.id] = d.m.buckets.find((x) => x.bucketId === b.id)?.allocated ?? 0;
    if (mode === "pct") {
      const total = d.gross || 1;
      for (const k of ["deductions", ...bucketMeta.map((b) => b.id)]) row[k] = Number(row[k]) / total;
    }
    return row;
  });
  const fmt = mode === "pct" ? (v: number) => `${(v * 100).toFixed(1)}%` : (v: number) => formatMoney(v);
  return (
    <ChartCard
      title="Where the gross went"
      summary={`Gross split into deductions and ${bucketMeta.map((b) => b.name).join(", ")} per period.`}
      legend={<Legend items={[{ label: "Deductions", color: "var(--deduction)", hatch: true }, ...bucketMeta.map((b) => ({ label: b.name, color: b.color }))]} />}
      action={
        <SegmentedControl
          size="sm"
          label="Scale"
          layoutId="gross-mode"
          value={mode}
          onChange={setMode}
          options={[
            { value: "abs", label: "₱" },
            { value: "pct", label: "100%" },
          ]}
        />
      }
      table={{ head: ["Period", "Gross", "Deductions", ...bucketMeta.map((b) => b.name)], rows: data.map((d) => [d.label, formatMoney(d.gross), formatMoney(d.deductions), ...bucketMeta.map((b) => formatMoney(d.m.buckets.find((x) => x.bucketId === b.id)?.allocated ?? 0))]) }}
    >
      <ResponsiveContainer width="100%" height={H}>
        <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="28%">
          <ChartDefs />
          <CartesianGrid {...GRID} />
          <XAxis dataKey="label" {...AXIS} tickLine={false} />
          <YAxis {...AXIS} width={56} tickLine={false} axisLine={false} tickFormatter={(v: number) => (mode === "pct" ? `${Math.round(v * 100)}%` : formatCompact(v))} domain={mode === "pct" ? [0, 1] : undefined} />
          <Tooltip cursor={{ fill: "var(--surface-2)" }} content={(p) => <ChartTooltip active={p.active} payload={p.payload} label={p.label} valueFormat={fmt} />} />
          <Bar dataKey="deductions" name="Deductions" stackId="g" fill="url(#hatch-deduction)" stroke="var(--surface)" strokeWidth={2} isAnimationActive={animate} />
          {bucketMeta.map((b, i) => (
            <Bar key={b.id} dataKey={b.id} name={b.name} stackId="g" fill={b.color} stroke="var(--surface)" strokeWidth={2} radius={i === bucketMeta.length - 1 ? [4, 4, 0, 0] : 0} isAnimationActive={animate} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

/* 5. Spending by category: one hue, sorted, top 8 + Others. */
export function SpendingByCategory({ rows, categories, animate }: { rows: { categoryId: string; amount: number }[]; categories: Map<string, Category>; animate: boolean }) {
  const data = rows.map((r) => {
    const c = categories.get(r.categoryId);
    return { name: r.categoryId === "__others" ? "📦 Others" : `${c?.emoji ?? ""} ${c?.name ?? "Unknown"}`, amount: r.amount };
  });
  return (
    <ChartCard
      title="Spending by category"
      summary={data.map((d) => `${d.name} ${formatMoney(d.amount)}`).join(", ") || "No spending."}
      table={{ head: ["Category", "Spent"], rows: data.map((d) => [d.name, formatMoney(d.amount)]) }}
    >
      {data.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">No spending in this range.</p>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(160, data.length * 34)}>
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 64, left: 0, bottom: 0 }} barCategoryGap={6}>
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="name" width={130} tick={{ fill: "var(--ink)", fontSize: 13 }} tickLine={false} axisLine={false} />
            <Tooltip cursor={{ fill: "var(--surface-2)" }} content={(p) => <ChartTooltip active={p.active} payload={p.payload} label={p.label} />} />
            <Bar dataKey="amount" name="Spent" fill="var(--essentials)" radius={[0, 4, 4, 0]} isAnimationActive={animate}>
              <LabelList dataKey="amount" position="right" formatter={money} fill="var(--ink)" fontSize={12} fontFamily="var(--font-mono)" />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

/* 6. Spending calendar: graph-paper month heatmap, one hue light → dark. */
export function SpendingCalendar({ monthKey, expenses }: { monthKey: string; expenses: Expense[] }) {
  const [y = 2026, m = 1] = monthKey.split("-").map(Number);
  const days = lastDay(y, m);
  const totals = new Map<number, number>();
  for (const e of expenses) {
    if (!e.date.startsWith(monthKey)) continue;
    const d = parseISODate(e.date).day;
    totals.set(d, (totals.get(d) ?? 0) + e.amount);
  }
  const max = Math.max(0, ...totals.values());
  const firstDow = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const steps = [0, 0.18, 0.36, 0.58, 0.82];
  const level = (v: number) => (v <= 0 || max === 0 ? 0 : Math.min(4, Math.ceil((v / max) * 4)));
  const biggest = [...totals.entries()].sort((a, b) => b[1] - a[1])[0];
  return (
    <ChartCard
      title="Spending calendar"
      eyebrow={`${MONTHS[m - 1]} ${y}`}
      summary={biggest ? `Biggest day: ${MONTHS[m - 1]} ${biggest[0]} with ${formatMoney(biggest[1])}.` : "No spending this month."}
      legend={
        <span className="flex items-center gap-1 text-xs text-muted" aria-hidden>
          less
          {steps.map((s, i) => (
            <span key={i} className="size-3 rounded-[2px] border border-line" style={{ background: s ? `color-mix(in oklab, var(--wants) ${s * 100}%, var(--surface))` : "var(--surface)" }} />
          ))}
          more
        </span>
      }
      table={{ head: ["Date", "Spent"], rows: [...totals.entries()].sort((a, b) => a[0] - b[0]).map(([d, v]) => [toISODate(y, m, d), formatMoney(v)]) }}
    >
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-muted">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
        {Array.from({ length: firstDow }, (_, i) => (
          <span key={`e${i}`} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const day = i + 1;
          const v = totals.get(day) ?? 0;
          const s = steps[level(v)] ?? 0;
          return (
            <div
              key={day}
              title={`${MONTHS[m - 1]} ${day}: ${formatMoney(v)}`}
              className="relative aspect-square rounded-[3px] border border-line"
              style={{ background: s ? `color-mix(in oklab, var(--wants) ${s * 100}%, var(--surface))` : "var(--surface)" }}
            >
              <span className={cn("absolute left-1 top-0.5 font-mono text-[9px]", s > 0.5 ? "text-white" : "text-muted")}>{day}</span>
            </div>
          );
        })}
      </div>
    </ChartCard>
  );
}
