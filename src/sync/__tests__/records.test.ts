import { describe, expect, it } from "vitest";
import type { Expense, ToBuyItem } from "@/domain/types";
import { defaultData } from "@/store/defaults";
import type { AppData } from "@/store/types";
import { applyRows, hashString, keyOf, planPull, planPush, shadowAfterPush, stableStringify, toRecords, type RemoteRow, type Shadow } from "../records";

const expense = (id: string, amount: number): Expense => ({
  id,
  date: "2026-10-20",
  cutoffId: "2026-10-A",
  amount,
  categoryId: "cat-food",
  bucketId: "essentials",
  createdAt: "2026-10-20T00:00:00.000Z",
});

const item = (id: string): ToBuyItem => ({
  id,
  name: "Bike",
  targetPrice: 500000,
  priority: "medium",
  bucketId: "wants",
  autoContribution: null,
  contributions: [],
  status: "saving",
  order: 0,
  createdAt: "2026-10-01T00:00:00.000Z",
});

/** An in-memory stand-in for the Supabase table, keyed like the real primary key. */
class FakeServer {
  rows = new Map<string, RemoteRow>();
  all = () => [...this.rows.values()].map((r) => structuredClone(r));
  write(rows: RemoteRow[]) {
    for (const r of rows) this.rows.set(keyOf(r.collection, r.id), structuredClone(r));
  }
}

/** One device: its data plus the shadow of what it last synced. Pulls everything each time (cursor not modelled). */
class Device {
  shadow: Shadow = {};
  constructor(public data: AppData) {}
  sync(server: FakeServer) {
    const plan = planPull(toRecords(this.data), this.shadow, server.all());
    if (plan.apply.length) this.data = applyRows(this.data, plan.apply);
    const pushes = planPush(toRecords(this.data), plan.shadow);
    server.write(pushes);
    this.shadow = shadowAfterPush(plan.shadow, pushes);
  }
}

describe("sync records", () => {
  it("stableStringify ignores key order and undefined fields", () => {
    expect(stableStringify({ b: 1, a: { d: [1, { y: 2, x: 1 }], c: undefined } })).toBe(stableStringify({ a: { d: [1, { x: 1, y: 2 }] }, b: 1 }));
    expect(hashString("a")).not.toBe(hashString("b"));
  });

  it("laptop To-Buy and phone expenses end up on both devices", () => {
    const server = new FakeServer();
    const laptop = new Device({ ...defaultData(), toBuy: [item("bike")] });
    const phone = new Device({ ...defaultData(), expenses: [expense("lunch", 25000)] });
    laptop.sync(server);
    phone.sync(server);
    laptop.sync(server);
    for (const d of [laptop, phone]) {
      expect(d.data.toBuy.map((x) => x.id)).toEqual(["bike"]);
      expect(d.data.expenses.map((x) => x.id)).toEqual(["lunch"]);
    }
    // Nothing left to push once both are in step.
    expect(planPush(toRecords(laptop.data), laptop.shadow)).toEqual([]);
    expect(planPush(toRecords(phone.data), phone.shadow)).toEqual([]);
  });

  it("a new device adopts the account's settings instead of pushing its defaults", () => {
    const server = new FakeServer();
    const laptop = new Device(defaultData());
    laptop.data = { ...laptop.data, settings: { ...laptop.data.settings, monthlyBasicSalary: 3000000 } };
    laptop.sync(server);
    const phone = new Device(defaultData());
    phone.sync(server);
    expect(phone.data.settings.monthlyBasicSalary).toBe(3000000);
  });

  it("keeps theme and motion per device", () => {
    const server = new FakeServer();
    const laptop = new Device({ ...defaultData(), settings: { ...defaultData().settings, theme: "workbench" } });
    laptop.sync(server);
    const phone = new Device(defaultData());
    phone.sync(server);
    expect(phone.data.settings.theme).toBe("paper");
  });

  it("edits and deletes travel; deleting on one device removes it on the other", () => {
    const server = new FakeServer();
    const laptop = new Device({ ...defaultData(), expenses: [expense("a", 100), expense("b", 200)] });
    laptop.sync(server);
    const phone = new Device(defaultData());
    phone.sync(server);

    phone.data = { ...phone.data, expenses: phone.data.expenses.filter((e) => e.id !== "a").map((e) => ({ ...e, amount: 999 })) };
    phone.sync(server);
    laptop.sync(server);
    expect(laptop.data.expenses).toEqual([expect.objectContaining({ id: "b", amount: 999 })]);
  });

  it("an edit made here since the last sync wins over an older remote copy", () => {
    const server = new FakeServer();
    const laptop = new Device({ ...defaultData(), expenses: [expense("a", 100)] });
    laptop.sync(server);
    const phone = new Device(defaultData());
    phone.sync(server);

    phone.data = { ...phone.data, expenses: [{ ...expense("a", 100), amount: 300 }] };
    laptop.data = { ...laptop.data, expenses: [{ ...expense("a", 100), amount: 500 }] };
    laptop.sync(server);
    phone.sync(server); // phone's pending edit is pushed, not overwritten
    laptop.sync(server);
    expect(phone.data.expenses[0]?.amount).toBe(300);
    expect(laptop.data.expenses[0]?.amount).toBe(300);
  });

  it("an edit elsewhere brings back an item deleted here", () => {
    const server = new FakeServer();
    const laptop = new Device({ ...defaultData(), toBuy: [item("bike")] });
    laptop.sync(server);
    const phone = new Device(defaultData());
    phone.sync(server);

    laptop.data = { ...laptop.data, toBuy: [] };
    phone.data = { ...phone.data, toBuy: [{ ...item("bike"), name: "Road bike" }] };
    phone.sync(server);
    laptop.sync(server);
    expect(laptop.data.toBuy.map((x) => x.name)).toEqual(["Road bike"]);
  });

  it("ignores unknown collections from the server", () => {
    const local = toRecords(defaultData());
    const plan = planPull(local, {}, [{ collection: "mystery", id: "x", data: {}, deleted: false }]);
    expect(plan.apply).toEqual([]);
  });
});
