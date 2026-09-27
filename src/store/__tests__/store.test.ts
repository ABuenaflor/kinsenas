import { beforeEach, describe, expect, it } from "vitest";
import { allocateAmounts, presetShares } from "@/domain/allocation";
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

  it("editing a saved cutoff reuses the rates, deductions and rule it was saved with", () => {
    const s = useStore.getState();
    s.updateSettings({ monthlyBasicSalary: P(30000) });
    s.upsertCustomDeduction({ id: "loan", name: "Loan", kind: "fixed", amount: P(500), percent: 0, schedule: "every", active: true, order: 0 });
    const ruleId = s.settings.activeRuleId;
    const first = useStore.getState().saveCutoff({ cutoffId: "2026-09-A", gross: P(15000), govAlreadyDeducted: false, ruleId }).cutoff;
    expect(first.basis?.govRates.sss.employeeRate).toBe(500);

    // Settings change after saving…
    const st = useStore.getState();
    st.setGovRates({ ...st.govRates, sss: { ...st.govRates.sss, employeeRate: 600 } });
    st.removeCustomDeduction("loan");
    st.updateSettings({ monthlyBasicSalary: P(50000) });
    const rule = st.rules[0]!;
    st.upsertRule({ ...rule, shares: rule.shares.map((sh, i) => ({ ...sh, percent: [7000, 2000, 1000][i]! })) });

    // …then fix a typo in the saved cutoff: same gross, only the note changes.
    const edited = useStore.getState().saveCutoff({ cutoffId: "2026-09-A", gross: P(15000), govAlreadyDeducted: false, ruleId, note: "typo fixed" }).cutoff;
    expect(edited.deductions).toEqual(first.deductions);
    expect(edited.allocations).toEqual(first.allocations);
    expect(edited.net).toBe(P(12771.3)); // §17 A minus insurance: still the old rates, loan and 50/30/20

    // Changing gross while editing still uses the stored basis.
    const bigger = useStore.getState().saveCutoff({ cutoffId: "2026-09-A", gross: P(16000), govAlreadyDeducted: false, ruleId }).cutoff;
    expect(bigger.deductions.find((d) => d.key === "gov:sss")?.amount).toBe(P(750));
    expect(bigger.deductions.some((d) => d.key === "custom:loan")).toBe(true);

    // Re-apply swaps in the current settings and a new basis.
    useStore.getState().reapplyCutoff("2026-09-A");
    const reapplied = useStore.getState().cutoffs.find((c) => c.id === "2026-09-A");
    expect(reapplied?.deductions.find((d) => d.key === "gov:sss")?.amount).toBe(P(1050));
    expect(reapplied?.deductions.some((d) => d.key === "custom:loan")).toBe(false);
    expect(reapplied?.basis?.govRates.sss.employeeRate).toBe(600);
  });

  it("picking a different rule while editing uses that rule as it is now", () => {
    const s = useStore.getState();
    const other = { id: "r-701010", name: "70/20/10", shares: presetShares(["savings", "essentials", "wants"], [7000, 2000, 1000]) };
    s.upsertRule(other);
    const saved = s.saveCutoff({ cutoffId: "2026-09-A", gross: P(15000), govAlreadyDeducted: false, ruleId: s.settings.activeRuleId }).cutoff;
    const edited = useStore.getState().saveCutoff({ cutoffId: "2026-09-A", gross: P(15000), govAlreadyDeducted: false, ruleId: other.id }).cutoff;
    expect(edited.net).toBe(saved.net);
    expect(edited.ruleId).toBe(other.id);
    expect(edited.allocations.map((a) => a.amount)).toEqual(allocateAmounts(saved.net, other.shares));
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
    expect(STORE_VERSION).toBe(2);
  });
  it("migrates v1 → v2 keeping cutoffs without a basis", () => {
    const v1 = { ...defaultData(), cutoffs: [{ id: "2026-09-A", gross: 100 }] };
    const m = migrate(v1, 1);
    expect(m.cutoffs).toEqual(v1.cutoffs);
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
  it("merge keeps current settings unless asked to include them", () => {
    const backup = generateDemoData("2026-09-27", { first: 10, second: 25 });
    useStore.getState().mergeData(backup);
    expect(useStore.getState().settings.paydays).toEqual({ first: 15, second: "last" });
    expect(useStore.getState().cutoffs.length).toBe(backup.cutoffs.length);
    useStore.getState().updateSettings({ theme: "workbench" });
    useStore.getState().mergeData(backup, { includeSettings: true });
    expect(useStore.getState().settings.paydays).toEqual({ first: 10, second: 25 });
    expect(useStore.getState().settings.theme).toBe("workbench");
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
