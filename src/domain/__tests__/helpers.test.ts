import { describe, expect, it } from "vitest";
import { formatBps, formatCompact, formatMoney, parseBps, parseMoney, pct } from "@/lib/money";
import { cutoffLabel, nextCutoffId, nextPayday, periodRange, prevCutoffId } from "@/lib/periods";
import { customApplies } from "../deductions";
import { etaOf, autoContributionFor, nextStatus } from "../toBuy";
import type { CustomDeduction, ToBuyItem } from "../types";

describe("money", () => {
  it("parses", () => {
    expect(parseMoney("25,000.50")).toBe(2500050);
    expect(parseMoney("₱ 1,234")).toBe(123400);
    expect(parseMoney("0.5")).toBe(50);
    expect(parseMoney(".75")).toBe(75);
    expect(parseMoney("1.234")).toBeNull();
    expect(parseMoney("abc")).toBeNull();
    expect(parseMoney("")).toBeNull();
  });
  it("formats", () => {
    expect(formatMoney(2500050)).toBe("₱25,000.50");
    expect(formatCompact(2500000)).toBe("₱25.0k");
    expect(formatBps(5000)).toBe("50%");
    expect(formatBps(3333)).toBe("33.33%");
    expect(formatBps(1250)).toBe("12.5%");
    expect(parseBps("33.33")).toBe(3333);
  });
  it("pct rounds half away from zero", () => {
    expect(pct(1, 5000)).toBe(1);
    expect(pct(-1, 5000)).toBe(-1);
  });
});

describe("periods", () => {
  const pd = { first: 15, second: "last" as const };
  it("navigates", () => {
    expect(nextCutoffId("2026-12-B")).toBe("2027-01-A");
    expect(prevCutoffId("2026-01-A")).toBe("2025-12-B");
  });
  it("range", () => {
    expect(periodRange("2026-02-A", pd)).toEqual({ start: "2026-02-15", end: "2026-02-27" });
    expect(periodRange("2026-02-B", pd)).toEqual({ start: "2026-02-28", end: "2026-03-14" });
  });
  it("next payday", () => {
    expect(nextPayday("2026-09-27", pd)).toEqual({ id: "2026-09-B", date: "2026-09-30", inDays: 3 });
    expect(nextPayday("2026-09-15", pd).inDays).toBe(0);
  });
  it("labels", () => expect(cutoffLabel("2026-09-A", pd)).toBe("Sep 2026 · 15th"));
});

describe("custom deductions", () => {
  const d: CustomDeduction = {
    id: "x",
    name: "Loan",
    kind: "fixed",
    amount: 100,
    percent: 0,
    schedule: "every",
    startCutoff: "2026-03-A",
    endCutoff: "2026-06-B",
    active: true,
    order: 0,
  };
  it("respects range and schedule", () => {
    expect(customApplies(d, "2026-02-B")).toBe(false);
    expect(customApplies(d, "2026-03-A")).toBe(true);
    expect(customApplies(d, "2026-06-B")).toBe(true);
    expect(customApplies(d, "2026-07-A")).toBe(false);
    expect(customApplies({ ...d, schedule: "B" }, "2026-04-A")).toBe(false);
    expect(customApplies({ ...d, active: false }, "2026-04-A")).toBe(false);
  });
});

describe("to-buy", () => {
  const item: ToBuyItem = {
    id: "t",
    name: "Bike",
    targetPrice: 1000000,
    priority: "high",
    bucketId: "wants",
    autoContribution: { kind: "fixed", amount: 200000 },
    contributions: [{ id: "c", cutoffId: "2026-09-A", amount: 200000, date: "2026-09-15", auto: true }],
    status: "saving",
    order: 0,
    createdAt: "",
  };
  it("eta", () => {
    const eta = etaOf(item, "2026-09-A", { first: 15, second: "last" });
    expect(eta?.paydays).toBe(4);
    expect(eta?.cutoffId).toBe("2026-11-A");
  });
  it("auto contribution capped at remaining", () => {
    expect(autoContributionFor({ ...item, autoContribution: { kind: "fixed", amount: 9000000 } }, [])).toBe(800000);
    expect(
      autoContributionFor({ ...item, autoContribution: { kind: "percentOfBucket", percent: 1000 } }, [
        { bucketId: "wants", name: "Wants", color: "", countsAsSavings: false, amount: 250000 },
      ]),
    ).toBe(25000);
  });
  it("status", () => {
    expect(nextStatus({ ...item, contributions: [{ ...item.contributions[0]!, amount: 1000000 }] })).toBe("ready");
  });
});
