import { clamp, pct } from "@/lib/money";
import type { Centavos, GovDeduction, GovRates, Half } from "./types";

export function sssMonthly(monthly: Centavos, rates: GovRates["sss"]): { msc: Centavos; share: Centavos } {
  const { mscStep: step, mscMin, mscMax, employeeRate } = rates;
  const rounded = Math.floor((monthly + step / 2) / step) * step;
  const msc = clamp(rounded, mscMin, mscMax);
  return { msc, share: pct(msc, employeeRate) };
}

export function philhealthMonthly(monthly: Centavos, rates: GovRates["philhealth"]): Centavos {
  return pct(clamp(monthly, rates.floor, rates.ceiling), rates.employeeRate);
}

export function pagibigMonthly(monthly: Centavos, rates: GovRates["pagibig"]): Centavos {
  const rate = monthly <= rates.lowThreshold ? rates.lowRate : rates.highRate;
  return pct(Math.min(monthly, rates.maxFundSalary), rate);
}

/** Put a monthly amount onto one cutoff according to its schedule. */
export function scheduleMonthly(monthly: Centavos, schedule: GovDeduction["schedule"], half: Half): Centavos {
  if (schedule === "A") return half === "A" ? monthly : 0;
  if (schedule === "B") return half === "B" ? monthly : 0;
  const a = Math.floor(monthly / 2);
  return half === "A" ? a : monthly - a;
}

export type ContribId = "sss" | "philhealth" | "pagibig";

export function monthlyShare(id: ContribId, monthly: Centavos, rates: GovRates): Centavos {
  if (id === "sss") return sssMonthly(monthly, rates.sss).share;
  if (id === "philhealth") return philhealthMonthly(monthly, rates.philhealth);
  return pagibigMonthly(monthly, rates.pagibig);
}

/** This cutoff's amount for one contribution, honoring enabled/mode/schedule. */
export function contributionForCutoff(
  config: GovDeduction,
  monthlyBasis: Centavos,
  half: Half,
  rates: GovRates,
): Centavos {
  if (!config.enabled || config.id === "tax") return 0;
  if (config.mode === "fixed") {
    return config.schedule === "split" || config.schedule === half ? config.fixedAmount : 0;
  }
  return scheduleMonthly(monthlyShare(config.id, monthlyBasis, rates), config.schedule, half);
}
