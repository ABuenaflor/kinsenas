import { describe, expect, it } from "vitest";
import { allocate, allocateAmounts, largestRemainder, validateRule } from "../allocation";
import { pagibigMonthly, philhealthMonthly, scheduleMonthly, sssMonthly } from "../contributions";
import { buildCutoff, computeCutoff, type CutoffContext } from "../computeCutoff";
import { DEFAULT_GOV_DEDUCTIONS, PH_2026 } from "../govRates";
import { periodMetrics } from "../metrics";
import { withholdingTax } from "../tax";
import type { AllocationRule, Bucket, CustomDeduction, Expense, ToBuyItem } from "../types";
import { periodOf } from "@/lib/periods";

const P = (pesos: number) => Math.round(pesos * 100);

const buckets: Bucket[] = [
  { id: "savings", name: "Savings", color: "var(--savings)", countsAsSavings: true, archived: false, order: 0 },
  { id: "essentials", name: "Essentials", color: "var(--essentials)", countsAsSavings: false, archived: false, order: 1 },
  { id: "wants", name: "Wants", color: "var(--wants)", countsAsSavings: false, archived: false, order: 2 },
  { id: "efund", name: "Emergency fund", color: "var(--savings)", countsAsSavings: true, archived: false, order: 3 },
];
const rule503020: AllocationRule = {
  id: "r1",
  name: "50/30/20",
  shares: [
    { bucketId: "savings", kind: "percent", percent: 5000, fixedAmount: 0 },
    { bucketId: "essentials", kind: "percent", percent: 3000, fixedAmount: 0 },
    { bucketId: "wants", kind: "percent", percent: 2000, fixedAmount: 0 },
  ],
};
const ruleWithEfund: AllocationRule = {
  id: "r2",
  name: "EF first",
  shares: [{ bucketId: "efund", kind: "fixed", percent: 0, fixedAmount: P(1000) }, ...rule503020.shares],
};
const customs: CustomDeduction[] = [
  { id: "loan", name: "Company loan", kind: "fixed", amount: P(500), percent: 0, schedule: "every", active: true, order: 0 },
  { id: "ins", name: "Insurance", kind: "fixed", amount: P(250), percent: 0, schedule: "A", active: true, order: 1 },
];

function ctx(monthly: number | null, customDeductions: CustomDeduction[] = []): CutoffContext {
  return {
    settings: { paydays: { first: 15, second: "last" }, monthlyBasicSalary: monthly === null ? null : P(monthly) },
    govRates: PH_2026,
    govDeductions: DEFAULT_GOV_DEDUCTIONS,
    customDeductions,
    buckets,
    rules: [rule503020, ruleWithEfund],
  };
}
const line = (r: ReturnType<typeof computeCutoff>, key: string) => r.deductions.find((d) => d.key === key)?.amount;
const alloc = (r: ReturnType<typeof computeCutoff>) => r.allocations.map((a) => a.amount);

describe("A. Typical cutoff", () => {
  const c = ctx(30000, customs);
  it("monthly shares", () => {
    expect(sssMonthly(P(30000), PH_2026.sss).share).toBe(P(1500));
    expect(philhealthMonthly(P(30000), PH_2026.philhealth)).toBe(P(750));
    expect(pagibigMonthly(P(30000), PH_2026.pagibig)).toBe(P(200));
  });
  it("cutoff A", () => {
    const r = computeCutoff({ cutoffId: "2026-09-A", gross: P(15000), govAlreadyDeducted: false, ruleId: "r1" }, c);
    expect(line(r, "gov:sss")).toBe(P(750));
    expect(line(r, "gov:philhealth")).toBe(P(375));
    expect(line(r, "gov:pagibig")).toBe(P(100));
    expect(r.taxable).toBe(P(13775));
    expect(line(r, "gov:tax")).toBe(P(503.7));
    expect(r.totalDeductions).toBe(P(2478.7));
    expect(r.net).toBe(P(12521.3));
    expect(alloc(r)).toEqual([P(6260.65), P(3756.39), P(2504.26)]);
  });
  it("cutoff B (no insurance)", () => {
    const r = computeCutoff({ cutoffId: "2026-09-B", gross: P(15000), govAlreadyDeducted: false, ruleId: "r1" }, c);
    expect(r.totalDeductions).toBe(P(2228.7));
    expect(r.net).toBe(P(12771.3));
    expect(alloc(r)).toEqual([P(6385.65), P(3831.39), P(2554.26)]);
  });
  it("fixed Emergency fund share first", () => {
    const r = computeCutoff({ cutoffId: "2026-09-A", gross: P(15000), govAlreadyDeducted: false, ruleId: "r2" }, c);
    expect(alloc(r)).toEqual([P(1000), P(5760.65), P(3456.39), P(2304.26)]);
  });
});

describe("B/C. Low and high salary", () => {
  it("B. low salary", () => {
    const r = computeCutoff({ cutoffId: "2026-09-A", gross: P(4000), govAlreadyDeducted: false, ruleId: "r1" }, ctx(8000));
    expect(sssMonthly(P(8000), PH_2026.sss).share).toBe(P(400));
    expect(philhealthMonthly(P(8000), PH_2026.philhealth)).toBe(P(250));
    expect(pagibigMonthly(P(8000), PH_2026.pagibig)).toBe(P(160));
    expect([line(r, "gov:sss"), line(r, "gov:philhealth"), line(r, "gov:pagibig"), line(r, "gov:tax")]).toEqual([
      P(200),
      P(125),
      P(80),
      0,
    ]);
    expect(r.net).toBe(P(3595));
  });
  it("C. high salary", () => {
    const r = computeCutoff({ cutoffId: "2026-09-A", gross: P(60000), govAlreadyDeducted: false, ruleId: "r1" }, ctx(120000));
    expect(sssMonthly(P(120000), PH_2026.sss).share).toBe(P(1750));
    expect(philhealthMonthly(P(120000), PH_2026.philhealth)).toBe(P(2500));
    expect(pagibigMonthly(P(120000), PH_2026.pagibig)).toBe(P(200));
    expect(r.taxable).toBe(P(57775));
    expect(line(r, "gov:tax")).toBe(P(10381.2));
    expect(r.net).toBe(P(47393.8));
  });
  it("uses 2× cutoff gross when monthly basic is blank", () => {
    const r = computeCutoff({ cutoffId: "2026-09-A", gross: P(15000), govAlreadyDeducted: false, ruleId: "r1" }, ctx(null));
    expect(r.monthlyBasis).toBe(P(30000));
    expect(line(r, "gov:sss")).toBe(P(750));
  });
  it("govAlreadyDeducted zeroes gov + tax", () => {
    const r = computeCutoff({ cutoffId: "2026-09-A", gross: P(15000), govAlreadyDeducted: true, ruleId: "r1" }, ctx(30000, customs));
    expect(r.deductions.every((d) => d.source === "custom")).toBe(true);
    expect(r.net).toBe(P(15000 - 750));
  });
  it("negative net clamps allocations to 0", () => {
    const big: CustomDeduction[] = [{ ...customs[0]!, amount: P(99999) }];
    const r = computeCutoff({ cutoffId: "2026-09-A", gross: P(1000), govAlreadyDeducted: true, ruleId: "r1" }, ctx(null, big));
    expect(r.negativeNet).toBe(true);
    expect(alloc(r)).toEqual([0, 0, 0]);
  });
});

describe("D. SSS MSC boundaries", () => {
  const cases: [number, number, number][] = [
    [1000, 5000, 250],
    [5249.99, 5000, 250],
    [5250, 5500, 275],
    [5750, 6000, 300],
    [20000, 20000, 1000],
    [34749.99, 34500, 1725],
    [34750, 35000, 1750],
    [50000, 35000, 1750],
  ];
  it.each(cases)("%s → MSC %s → %s", (monthly, msc, share) => {
    expect(sssMonthly(P(monthly), PH_2026.sss)).toEqual({ msc: P(msc), share: P(share) });
  });
});

describe("E/F. Pag-IBIG & PhilHealth", () => {
  it.each([
    [1500, 15],
    [1500.01, 30],
    [8000, 160],
    [50000, 200],
  ])("Pag-IBIG %s → %s", (m, s) => expect(pagibigMonthly(P(m), PH_2026.pagibig)).toBe(P(s)));
  it.each([
    [8000, 250],
    [30000, 750],
    [150000, 2500],
  ])("PhilHealth %s → %s", (m, s) => expect(philhealthMonthly(P(m), PH_2026.philhealth)).toBe(P(s)));
});

describe("G. Withholding", () => {
  it.each([
    [10417, 0],
    [14000, 537.45],
    [16666.99, 937.5],
    [16667, 937.5],
    [40000, 5937.45],
  ])("%s → %s", (taxable, tax) => expect(withholdingTax(P(taxable), PH_2026.withholdingSemiMonthly)).toBe(P(tax)));
  it("never negative", () => expect(withholdingTax(-500, PH_2026.withholdingSemiMonthly)).toBe(0));
});

describe("H/I. Rounding", () => {
  it("net 1,000.01 at 50/30/20", () => {
    const r = allocate(P(1000.01), rule503020, buckets).map((a) => a.amount);
    expect(r).toEqual([P(500.01), P(300), P(200)]);
  });
  it("net 100.00 at 33.33/33.33/33.34", () => {
    expect(largestRemainder(P(100), [3333, 3333, 3334])).toEqual([P(33.33), P(33.33), P(33.34)]);
  });
  it("parts always sum exactly", () => {
    for (const net of [1, 7, 99, 100001, 1252130, 999999]) {
      const parts = allocateAmounts(net, rule503020.shares);
      expect(parts.reduce((a, b) => a + b, 0)).toBe(net);
    }
  });
  it("fixed share capped at remaining", () => {
    expect(allocateAmounts(P(500), ruleWithEfund.shares)).toEqual([P(500), 0, 0, 0]);
  });
  it("I. split odd centavo", () => {
    expect(scheduleMonthly(P(750.03), "split", "A")).toBe(P(375.01));
    expect(scheduleMonthly(P(750.03), "split", "B")).toBe(P(375.02));
  });
  it("rule validation requires 100%", () => {
    expect(validateRule(rule503020).ok).toBe(true);
    const bad = { ...rule503020, shares: rule503020.shares.map((s, i) => (i === 0 ? { ...s, percent: 4900 } : s)) };
    expect(validateRule(bad).ok).toBe(false);
    expect(validateRule({ ...rule503020, shares: [ruleWithEfund.shares[0]!] }).ok).toBe(false);
  });
});

describe("J. Pay periods", () => {
  const last = { first: 15, second: "last" as const };
  it.each([
    ["2026-01-01", "2025-12-B"],
    ["2026-01-14", "2025-12-B"],
    ["2026-01-15", "2026-01-A"],
    ["2026-01-30", "2026-01-A"],
    ["2026-01-31", "2026-01-B"],
    ["2026-02-27", "2026-02-A"],
    ["2026-02-28", "2026-02-B"],
    ["2028-02-28", "2028-02-A"],
    ["2028-02-29", "2028-02-B"],
    ["2026-03-14", "2026-02-B"],
    ["2026-04-29", "2026-04-A"],
    ["2026-04-30", "2026-04-B"],
    ["2026-12-31", "2026-12-B"],
  ])("15/last: %s → %s", (d, id) => expect(periodOf(d, last)).toBe(id));
  const thirty = { first: 15, second: 30 };
  it.each([
    ["2026-02-28", "2026-02-B"],
    ["2026-03-29", "2026-03-A"],
    ["2026-03-30", "2026-03-B"],
    ["2026-03-31", "2026-03-B"],
  ])("15/30: %s → %s", (d, id) => expect(periodOf(d, thirty)).toBe(id));
});

describe("K. Metrics", () => {
  const cutoff = buildCutoff(
    { cutoffId: "2026-09-A", gross: P(15000), govAlreadyDeducted: false, ruleId: "r1" },
    ctx(30000, customs),
    "2026-09-15T00:00:00Z",
  );
  const exp = (id: string, amount: number, bucketId: string, toBuyItemId?: string): Expense => ({
    id,
    amount: P(amount),
    date: "2026-09-16",
    categoryId: "c",
    bucketId,
    cutoffId: "2026-09-A",
    createdAt: "",
    toBuyItemId,
  });
  const expenses = [exp("e1", 1200, "essentials"), exp("e2", 800, "wants"), exp("e3", 300, "savings")];
  const item: ToBuyItem = {
    id: "t1",
    name: "Headphones",
    targetPrice: P(500),
    priority: "medium",
    bucketId: "wants",
    autoContribution: null,
    contributions: [{ id: "c1", cutoffId: "2026-09-A", amount: P(500), date: "2026-09-15", auto: false }],
    status: "ready",
    order: 0,
    createdAt: "",
  };
  const bucket = (m: ReturnType<typeof periodMetrics>, id: string) => m.buckets.find((b) => b.bucketId === id);

  it("before purchase", () => {
    const m = periodMetrics(["2026-09-A"], { cutoffs: [cutoff], expenses, toBuy: [item], buckets });
    expect(m.spent).toBe(P(2300));
    expect(bucket(m, "essentials")?.remaining).toBe(P(2556.39));
    expect(bucket(m, "wants")?.remaining).toBe(P(1204.26));
    expect(m.saved).toBe(P(5960.65));
  });
  it("after purchase: no double count", () => {
    const bought: ToBuyItem = { ...item, status: "bought", purchase: { expenseId: "e4", actualPrice: P(500), date: "2026-09-20" } };
    const m = periodMetrics(["2026-09-A"], {
      cutoffs: [cutoff],
      expenses: [...expenses, { ...exp("e4", 500, "wants", "t1"), date: "2026-09-20" }],
      toBuy: [bought],
      buckets,
    });
    expect(bucket(m, "wants")?.remaining).toBe(P(1204.26));
  });
});

describe("L. Snapshots", () => {
  it("stored cutoff is independent of later rule/rate changes", () => {
    const c = ctx(30000, customs);
    const saved = buildCutoff({ cutoffId: "2026-09-A", gross: P(15000), govAlreadyDeducted: false, ruleId: "r1" }, c, "t");
    const snapshot = JSON.parse(JSON.stringify(saved));
    const changed: CutoffContext = {
      ...c,
      govRates: { ...PH_2026, sss: { ...PH_2026.sss, employeeRate: 600 } },
      rules: [{ ...rule503020, shares: rule503020.shares.map((s, i) => ({ ...s, percent: [7000, 2000, 1000][i]! })) }],
    };
    const recomputed = computeCutoff({ cutoffId: saved.id, gross: saved.gross, govAlreadyDeducted: false, ruleId: "r1" }, changed);
    expect(recomputed.net).not.toBe(saved.net);
    expect(saved).toEqual(snapshot);
  });
});
