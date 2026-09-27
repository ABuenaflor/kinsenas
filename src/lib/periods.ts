import type { CutoffId, Half, ISODate, Paydays } from "@/domain/types";

export const DEFAULT_PAYDAYS: Paydays = { first: 15, second: "last" };

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function lastDay(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function toISODate(year: number, month: number, day: number): ISODate {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function parseISODate(d: ISODate): { year: number; month: number; day: number } {
  const [y, m, dd] = d.split("-").map(Number);
  return { year: y ?? 1970, month: m ?? 1, day: dd ?? 1 };
}

/** Local "today" as an ISO date. Only call from UI code, never from domain functions. */
export function todayISO(now: Date = new Date()): ISODate {
  return toISODate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function paydayDays(year: number, month: number, paydays: Paydays): { d1: number; d2: number } {
  const last = lastDay(year, month);
  const d1 = Math.min(paydays.first, last);
  const d2 = paydays.second === "last" ? last : Math.min(paydays.second, last);
  return { d1, d2 };
}

export function makeCutoffId(year: number, month: number, half: Half): CutoffId {
  return `${year}-${pad2(month)}-${half}`;
}

export function parseCutoffId(id: CutoffId): { year: number; month: number; half: Half } {
  const [y, m, h] = id.split("-");
  return { year: Number(y), month: Number(m), half: h === "B" ? "B" : "A" };
}

export function isCutoffId(id: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])-[AB]$/.test(id);
}

export function payDateOf(id: CutoffId, paydays: Paydays): ISODate {
  const { year, month, half } = parseCutoffId(id);
  const { d1, d2 } = paydayDays(year, month, paydays);
  return toISODate(year, month, half === "A" ? d1 : d2);
}

export function nextCutoffId(id: CutoffId): CutoffId {
  const { year, month, half } = parseCutoffId(id);
  if (half === "A") return makeCutoffId(year, month, "B");
  return month === 12 ? makeCutoffId(year + 1, 1, "A") : makeCutoffId(year, month + 1, "A");
}

export function prevCutoffId(id: CutoffId): CutoffId {
  const { year, month, half } = parseCutoffId(id);
  if (half === "B") return makeCutoffId(year, month, "A");
  return month === 1 ? makeCutoffId(year - 1, 12, "B") : makeCutoffId(year, month - 1, "B");
}

/** Which pay period (cutoff) a date's spending belongs to. */
export function periodOf(date: ISODate, paydays: Paydays): CutoffId {
  const { year, month, day } = parseISODate(date);
  const { d1, d2 } = paydayDays(year, month, paydays);
  if (day >= d2) return makeCutoffId(year, month, "B");
  if (day >= d1) return makeCutoffId(year, month, "A");
  return prevCutoffId(makeCutoffId(year, month, "A"));
}

export function addDays(date: ISODate, days: number): ISODate {
  const { year, month, day } = parseISODate(date);
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return toISODate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** Inclusive date range covered by a cutoff's pay period. */
export function periodRange(id: CutoffId, paydays: Paydays): { start: ISODate; end: ISODate } {
  return { start: payDateOf(id, paydays), end: addDays(payDateOf(nextCutoffId(id), paydays), -1) };
}

/** Whole days from a to b (b − a). */
export function daysBetween(a: ISODate, b: ISODate): number {
  const pa = parseISODate(a);
  const pb = parseISODate(b);
  return Math.round(
    (Date.UTC(pb.year, pb.month - 1, pb.day) - Date.UTC(pa.year, pa.month - 1, pa.day)) / 86_400_000,
  );
}

/** The next payday on or after `today` (today counts if it is a payday). */
export function nextPayday(today: ISODate, paydays: Paydays): { id: CutoffId; date: ISODate; inDays: number } {
  let id = periodOf(today, paydays);
  let date = payDateOf(id, paydays);
  if (date !== today) {
    id = nextCutoffId(id);
    date = payDateOf(id, paydays);
  }
  return { id, date, inDays: daysBetween(today, date) };
}

export function monthKey(id: CutoffId): string {
  return id.slice(0, 7);
}

export function monthLabel(key: string, long = false): string {
  const [y, m] = key.split("-").map(Number);
  const name = MONTHS[(m ?? 1) - 1] ?? "";
  return long ? `${name} ${y}` : `${name} '${String(y).slice(2)}`;
}

export function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  return n + (["th", "st", "nd", "rd"][n % 10] ?? "th");
}

export function halfLabel(half: Half, paydays: Paydays): string {
  if (half === "A") return ordinal(paydays.first);
  return paydays.second === "last" ? "End of month" : ordinal(paydays.second);
}

export function cutoffLabel(id: CutoffId, paydays: Paydays): string {
  const { year, month, half } = parseCutoffId(id);
  return `${MONTHS[month - 1]} ${year} · ${halfLabel(half, paydays)}`;
}

/** "Sep 15" */
export function shortDate(date: ISODate): string {
  const { month, day } = parseISODate(date);
  return `${MONTHS[month - 1]} ${day}`;
}

/** "Sep 15, 2026" */
export function longDate(date: ISODate): string {
  const { year, month, day } = parseISODate(date);
  return `${MONTHS[month - 1]} ${day}, ${year}`;
}

/** Month keys from `from` to `to` inclusive ("YYYY-MM"). */
export function monthKeysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let key = from;
  for (let i = 0; i < 600 && key <= to; i++) {
    out.push(key);
    key = shiftMonthKey(key, 1);
  }
  return out;
}

export function shiftMonthKey(key: string, delta: number): string {
  const [y = 1970, m = 1] = key.split("-").map(Number);
  const idx = y * 12 + (m - 1) + delta;
  return `${Math.floor(idx / 12)}-${pad2((idx % 12) + 1)}`;
}

/**
 * Cutoff the Payday page should open on: the most recent payday that isn't logged
 * yet (looking back one month at most), else the current cutoff for editing.
 */
export function defaultCutoffToLog(today: ISODate, paydays: Paydays, logged: ReadonlySet<CutoffId>): CutoffId {
  const current = periodOf(today, paydays);
  let id = current;
  for (let i = 0; i < 3; i++) {
    if (!logged.has(id)) return id;
    id = prevCutoffId(id);
  }
  return current;
}
