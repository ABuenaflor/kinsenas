import type { Bps, Centavos } from "@/domain/types";

/** amount × bps / 10000, rounded half away from zero. */
export function pct(amount: Centavos, bps: Bps): Centavos {
  const raw = (amount * bps) / 10000;
  return raw < 0 ? -Math.round(-raw) : Math.round(raw);
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

export function sum(values: readonly number[]): number {
  let s = 0;
  for (const v of values) s += v;
  return s;
}

/**
 * "₱25,000.50" | "25000.5" | "25,000" → centavos. Returns null for empty/invalid
 * input or more than 2 decimals.
 */
export function parseMoney(input: string): Centavos | null {
  const s = input.replace(/^\s*PHP/i, "").replace(/[₱\s,]/g, "");
  if (!/^-?\d*(\.\d{0,2})?$/.test(s) || !/\d/.test(s)) return null;
  const neg = s.startsWith("-");
  const [whole = "", frac = ""] = (neg ? s.slice(1) : s).split(".");
  const cents = Number(whole || "0") * 100 + Number((frac + "00").slice(0, 2));
  if (!Number.isSafeInteger(cents)) return null;
  return neg ? -cents : cents;
}

const fmt = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2 });
const fmtWhole = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 });
const plain = new Intl.NumberFormat("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 2500050 → "₱25,000.50" */
export function formatMoney(c: Centavos): string {
  return fmt.format(c / 100);
}

/** 2500050 → "₱25,001" */
export function formatMoneyWhole(c: Centavos): string {
  return fmtWhole.format(Math.round(c / 100));
}

/** 2500050 → "25,000.50" (no currency sign), for inputs. */
export function formatPlain(c: Centavos): string {
  return plain.format(c / 100);
}

/** Compact for charts: 2500000 → "₱25.0k", 150000000 → "₱1.5M". */
export function formatCompact(c: Centavos): string {
  const pesos = c / 100;
  const abs = Math.abs(pesos);
  const sign = pesos < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}₱${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}₱${(abs / 1_000).toFixed(1)}k`;
  return `${sign}₱${abs.toFixed(0)}`;
}

/** 5000 → "50%", 3333 → "33.33%", 1250 → "12.5%" */
export function formatBps(bps: Bps): string {
  const v = (bps / 100).toFixed(2).replace(/\.?0+$/, "");
  return `${v}%`;
}

/** "33.33" → 3333; null when invalid or > 2 decimals. */
export function parseBps(input: string): Bps | null {
  const s = input.replace(/[%\s]/g, "");
  if (!/^\d*(\.\d{0,2})?$/.test(s) || !/\d/.test(s)) return null;
  const [whole = "", frac = ""] = s.split(".");
  return Number(whole || "0") * 100 + Number((frac + "00").slice(0, 2));
}

/** part ÷ whole as a float for display only (progress bars, rates). Zero-safe. */
export function ratio(part: number, whole: number): number {
  return whole === 0 ? 0 : part / whole;
}
