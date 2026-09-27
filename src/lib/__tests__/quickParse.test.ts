import { describe, expect, it } from "vitest";
import { DEFAULT_BUCKETS, DEFAULT_CATEGORIES } from "@/store/defaults";
import { quickParse } from "../quickParse";

describe("quickParse", () => {
  it("250 lunch wants", () => {
    const r = quickParse("250 lunch wants", DEFAULT_CATEGORIES, DEFAULT_BUCKETS);
    expect(r.amount).toBe(25000);
    expect(r.category?.name).toBe("Food");
    expect(r.bucket?.id).toBe("wants");
    expect(r.note).toBe("lunch");
  });
  it("uses the category's default bucket", () => {
    const r = quickParse("grab 180.50", DEFAULT_CATEGORIES, DEFAULT_BUCKETS);
    expect(r.amount).toBe(18050);
    expect(r.category?.name).toBe("Transport");
    expect(r.bucket?.id).toBe("essentials");
  });
  it("category by name", () => {
    const r = quickParse("1,200 groceries sunday haul", DEFAULT_CATEGORIES, DEFAULT_BUCKETS);
    expect(r.amount).toBe(120000);
    expect(r.category?.name).toBe("Groceries");
    expect(r.note).toBe("sunday haul");
  });
});
