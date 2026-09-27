import type { GovDeduction, GovRates } from "./types";

export const RATES_REVIEWED = "Sep 2026";

export const PH_2026: GovRates = {
  label: "PH 2026 defaults",
  sss: { employeeRate: 500, mscMin: 500000, mscMax: 3500000, mscStep: 50000 },
  philhealth: { employeeRate: 250, floor: 1000000, ceiling: 10000000 },
  pagibig: { lowRate: 100, highRate: 200, lowThreshold: 150000, maxFundSalary: 1000000 },
  withholdingSemiMonthly: [
    { over: 0, base: 0, rate: 0 },
    { over: 1041700, base: 0, rate: 1500 },
    { over: 1666700, base: 93750, rate: 2000 },
    { over: 3333300, base: 427070, rate: 2500 },
    { over: 8333300, base: 1677070, rate: 3000 },
    { over: 33333300, base: 9177070, rate: 3500 },
  ],
};

export const DEFAULT_GOV_DEDUCTIONS: GovDeduction[] = [
  { id: "sss", enabled: true, mode: "auto", fixedAmount: 0, schedule: "split" },
  { id: "philhealth", enabled: true, mode: "auto", fixedAmount: 0, schedule: "split" },
  { id: "pagibig", enabled: true, mode: "auto", fixedAmount: 0, schedule: "split" },
  { id: "tax", enabled: true, mode: "auto", fixedAmount: 0, schedule: "split" },
];

export const GOV_LABELS: Record<GovDeduction["id"], string> = {
  sss: "SSS",
  philhealth: "PhilHealth",
  pagibig: "Pag-IBIG",
  tax: "Withholding tax (est.)",
};
