import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";

export const AXIS = { stroke: "var(--line)", tick: { fill: "var(--muted)", fontSize: 12, fontFamily: "var(--font-mono)" } } as const;
export const GRID = { stroke: "var(--line)", strokeDasharray: "2 4", vertical: false } as const;

/** Shared SVG defs: the hatch texture used for deductions (secondary encoding for the neutral gray). */
export function ChartDefs() {
  return (
    <defs>
      <pattern id="hatch-deduction" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
        <rect width="6" height="6" fill="var(--deduction)" />
        <line x1="0" y1="0" x2="0" y2="6" stroke="var(--surface)" strokeWidth="2" />
      </pattern>
    </defs>
  );
}

interface TooltipEntry {
  name?: unknown;
  value?: unknown;
  color?: string;
  dataKey?: unknown;
  payload?: unknown;
}

/** Tokens-styled tooltip showing every series with ₱ values. */
export function ChartTooltip({
  active,
  payload,
  label,
  valueFormat = (v: number) => formatMoney(v),
}: {
  active?: boolean;
  payload?: readonly TooltipEntry[];
  label?: unknown;
  valueFormat?: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="card min-w-44 p-3 text-xs shadow-drawer">
      {label !== undefined && <p className="mb-1.5 font-semibold text-ink">{String(label)}</p>}
      <ul className="space-y-1">
        {payload.map((p, i) => (
          <li key={`${String(p.dataKey)}-${i}`} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted">
              <span aria-hidden className="size-2 rounded-[2px]" style={{ background: p.color?.startsWith("url(") ? "var(--deduction)" : p.color }} />
              {String(p.name)}
            </span>
            <span className="money text-ink">{typeof p.value === "number" ? valueFormat(p.value) : String(p.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string; hatch?: boolean; line?: boolean }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-hidden>
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-1.5">
          {it.line ? (
            <span className="h-0.5 w-4 rounded" style={{ background: it.color }} />
          ) : (
            <span className={cn("size-2.5 rounded-[3px]", it.hatch && "hatch-deduction")} style={it.hatch ? { background: "repeating-linear-gradient(45deg, var(--deduction) 0 2px, var(--surface) 2px 4px)" } : { background: it.color }} />
          )}
          {it.label}
        </li>
      ))}
    </ul>
  );
}

/** Card wrapper with title, legend, an aria summary, and a "View as table" fallback. */
export function ChartCard({
  title,
  eyebrow,
  summary,
  legend,
  table,
  children,
  className,
  action,
}: {
  title: string;
  eyebrow?: string;
  summary: string;
  legend?: ReactNode;
  table?: { head: string[]; rows: (string | number)[][] };
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <figure className={cn("card p-5 md:p-6", className)} aria-label={`${title}. ${summary}`}>
      <figcaption className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          <p className="sr-only">{summary}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {legend}
          {action}
        </div>
      </figcaption>
      <div aria-hidden>{children}</div>
      {table && table.rows.length > 0 && (
        <details className="mt-3 text-sm">
          <summary className="inline-flex min-h-11 cursor-pointer items-center text-xs text-muted hover:text-ink">View as table</summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-muted">
                <tr>
                  {table.head.map((h) => (
                    <th key={h} className="py-1 pr-3 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="money">
                {table.rows.map((r, i) => (
                  <tr key={i} className="border-t border-line">
                    {r.map((c, j) => (
                      <td key={j} className="py-1 pr-3">
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </figure>
  );
}
