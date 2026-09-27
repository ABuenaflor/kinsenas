import { pct } from "@/lib/money";
import type { Centavos, TaxBracket } from "./types";

/** Semi-monthly withholding estimate for a taxable amount. Never negative. */
export function withholdingTax(taxable: Centavos, brackets: readonly TaxBracket[]): Centavos {
  if (taxable <= 0) return 0;
  let bracket: TaxBracket | undefined;
  for (const b of brackets) {
    if (taxable >= b.over && (!bracket || b.over >= bracket.over)) bracket = b;
  }
  if (!bracket) return 0;
  return Math.max(0, bracket.base + pct(taxable - bracket.over, bracket.rate));
}
