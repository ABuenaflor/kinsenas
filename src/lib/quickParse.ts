import type { Bucket, Category, Centavos } from "@/domain/types";
import { parseMoney } from "./money";

const KEYWORDS: Record<string, string[]> = {
  food: ["lunch", "dinner", "breakfast", "merienda", "snack", "kape", "coffee", "ulam", "rice"],
  transport: ["grab", "jeep", "taxi", "mrt", "lrt", "bus", "angkas", "tricycle", "fare", "gas", "joyride"],
  bills: ["meralco", "water", "electric", "bill"],
  groceries: ["grocery", "palengke", "market", "puregold", "sm"],
  "load/internet": ["load", "wifi", "fiber", "data", "globe", "smart", "pldt"],
  health: ["meds", "medicine", "vitamins", "doctor", "checkup", "pharmacy"],
  "eating out": ["samgyup", "resto", "jollibee", "mcdo", "starbucks", "milktea"],
  leisure: ["movie", "netflix", "spotify", "game", "steam"],
  shopping: ["shopee", "lazada", "clothes", "shoes"],
  rent: ["rent", "upa"],
};

export interface QuickParse {
  amount: Centavos | null;
  category?: Category;
  bucket?: Bucket;
  note: string;
}

/** Parse natural quick-add input like "250 lunch wants" or "grab 180". */
export function quickParse(input: string, categories: readonly Category[], buckets: readonly Bucket[]): QuickParse {
  const tokens = input.trim().split(/\s+/).filter(Boolean);
  let amount: Centavos | null = null;
  let category: Category | undefined;
  let bucket: Bucket | undefined;
  const noteParts: string[] = [];
  const liveCats = categories.filter((c) => !c.archived);
  const liveBuckets = buckets.filter((b) => !b.archived);

  for (const raw of tokens) {
    const t = raw.toLowerCase();
    if (amount === null && /^₱?[\d,]+(\.\d{1,2})?$/.test(raw)) {
      amount = parseMoney(raw);
      continue;
    }
    const b = !bucket && t.length >= 3 ? liveBuckets.find((x) => x.name.toLowerCase().startsWith(t)) : undefined;
    if (b) {
      bucket = b;
      continue;
    }
    const exact = !category ? liveCats.find((c) => c.name.toLowerCase() === t || c.name.toLowerCase().split("/")[0] === t) : undefined;
    if (exact) {
      category = exact;
      continue;
    }
    if (!category) {
      const key = Object.entries(KEYWORDS).find(([, words]) => words.includes(t))?.[0];
      const match = key ? liveCats.find((c) => c.name.toLowerCase() === key) : undefined;
      if (match) category = match;
    }
    noteParts.push(raw);
  }
  if (!bucket && category?.defaultBucketId) bucket = liveBuckets.find((b) => b.id === category?.defaultBucketId);
  return { amount, category, bucket, note: noteParts.join(" ") };
}
