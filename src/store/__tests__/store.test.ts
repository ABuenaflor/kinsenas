import { beforeEach, describe, expect, it } from "vitest";
import { allocateAmounts } from "@/domain/allocation";
import { generateDemoData } from "@/dev/demoData";
import { defaultData } from "../defaults";
import { migrate, STORE_VERSION } from "../migrations";
import { makeExport, parseImport } from "../schema";
import { useStore } from "../useStore";

const P = (pesos: number) => Math.round(pesos * 100);

beforeEach(() => {
  useStore.getState().resetAll();
});

describe("store", () => {
  it("L. saved cutoffs don't change when rules or rates change, until re-applied", () => {
    const s = useStore.getState();
    s.updateSettings({ monthlyBasicSalary: P(30000) });
    const { cutoff } = useStore.getState().saveCutoff({ cutoffId: "2026-09-A", gross: P(15000), govAlreadyDeducted: false, ruleId: s.settings.activeRuleId });
    const before = structuredClone(cutoff);

    const rule = useStore.getState().rules[0]!;
    useStore.getState().upsertRule({ ...rule, shares: rule.shares.map((sh, i) => ({ ...sh, percent: [7000, 2000, 1000][i]! })) });
    useStore.getState().setGovRates({ ...useStore.getState().govRates, sss: { ...useStore.getState().govRates.sss, employeeRate: 600 } });
    expect(useStore.getState().cutoffs.find((c) => c.id === "2026-09-A")).toMatchObject({ net: before.net, allocations: before.allocations });

    useStore.getState().reapplyCutoff("2026-09-A");
    const after = useStore.getState().cutoffs.find((c) => c.id === "2026-09-A");
    expect(after?.net).not.toBe(before.net);
    const net = after?.net ?? 0;
    expect(after?.allocations.map((a) => a.amount)).toEqual(allocateAmounts(net, useStore.getState().rules[0]!.shares));
  });

  it("auto set-asides are created when a cutoff is saved, once", () => {
    const s = useStore.getState();
    const item = s.addItem({ name: "Bike", targetPrice: P(5000), priority: "medium", bucketId: "wants", autoContribution: { kind: "fixed", amount: P(1000) } });
    s.saveCutoff({ cutoffId: "2026-09-A", gross: P(15000), govAlreadyDeducted: false, ruleId: s.settings.activeRuleId });
    s.saveCutoff({ cutoffId: "2026-09-A", gross: P(16000), govAlreadyDeducted: false, ruleId: s.settings.activeRuleId });
    const updated = useStore.getState().toBuy.find((t) => t.id === item.id);
    expect(updated?.contributions).toHaveLength(1);
    expect(updated?.contributions[0]?.amount).toBe(P(1000));
  });

  it("mark bought creates a linked expense; deleting it reverts the item", () => {
    const s = useStore.getState();
    const item = s.addItem({ name: "Lamp", targetPrice: P(500), priority: "low", bucketId: "wants", autoContribution: null });
    s.addContribution(item.id, { amount: P(500), cutoffId: "2026-09-A", date: "2026-09-15" });
    expect(useStore.getState().toBuy[0]?.status).toBe("ready");
    const exp = useStore.getState().markBought(item.id, P(480), "2026-09-20");
    expect(exp?.cutoffId).toBe("2026-09-A");
    expect(useStore.getState().toBuy[0]?.status).toBe("bought");
    useStore.getState().removeExpense(exp!.id);
    expect(useStore.getState().toBuy[0]?.status).toBe("ready");
  });

  it("undo via snapshot/restore", () => {
    const snap = useStore.getState().snapshot();
    useStore.getState().addExpense({ amount: 100, date: "2026-09-20", categoryId: "cat-food", bucketId: "essentials" });
    expect(useStore.getState().expenses).toHaveLength(1);
    useStore.getState().restore(snap);
    expect(useStore.getState().expenses).toHaveLength(0);
  });

  it("buckets used in history are archived, not deleted", () => {
    const s = useStore.getState();
    s.upsertBucket({ id: "travel", name: "Travel", color: "var(--swatch-1)", countsAsSavings: false, archived: false, order: 3 });
    s.addExpense({ amount: 100, date: "2026-09-20", categoryId: "cat-food", bucketId: "travel" });
    expect(useStore.getState().removeBucket("travel")).toEqual({ ok: true, archived: true });
    expect(useStore.getState().removeBucket("savings").ok).toBe(false);
  });
});

describe("persistence", () => {
  it("migrates a v0 blob by filling defaults", () => {
    const m = migrate({ cutoffs: [] }, 0);
    expect(m.buckets).toEqual(defaultData().buckets);
    expect(STORE_VERSION).toBe(1);
  });
  it("export → import round-trips and reports bad fields", () => {
    const demo = generateDemoData("2026-09-27", { first: 15, second: "last" });
    const text = JSON.stringify(makeExport(demo, "2026-09-27T00:00:00Z"));
    const r = parseImport(text);
    expect(r.ok).toBe(true);
    const bad = JSON.parse(text);
    bad.data.expenses[0].amount = "lots";
    const rb = parseImport(JSON.stringify(bad));
    expect(rb.ok).toBe(false);
    if (!rb.ok) expect(rb.error).toMatch(/^data\.expenses\.0\.amount/);
    expect(parseImport("nope").ok).toBe(false);
  });
  it("demo data is deterministic and sized as spec'd", () => {
    const a = generateDemoData("2026-09-27", { first: 15, second: "last" });
    const b = generateDemoData("2026-09-27", { first: 15, second: "last" });
    expect(a).toEqual(b);
    expect(a.cutoffs.length).toBeGreaterThanOrEqual(11);
    expect(a.toBuy).toHaveLength(4);
    expect(a.cutoffs.every((c) => c.gross >= P(15000) && c.gross <= P(18000))).toBe(true);
  });
});
