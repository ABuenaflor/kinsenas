import { useId } from "react";
import { Field, MoneyInput, Select } from "@/components/ui/inputs";
import { ordinal } from "@/lib/periods";
import { useStore } from "@/store/useStore";

export function PaydayFields() {
  const id = useId();
  const settings = useStore((s) => s.settings);
  const update = useStore((s) => s.updateSettings);
  const { first, second } = settings.paydays;
  const secondNum = second === "last" ? 32 : second;
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Field label="First payday" htmlFor={`${id}-1`}>
        <Select id={`${id}-1`} value={first} onChange={(e) => update({ paydays: { ...settings.paydays, first: Number(e.target.value) } })}>
          {Array.from({ length: 27 }, (_, i) => i + 1)
            .filter((d) => d < secondNum)
            .map((d) => (
              <option key={d} value={d}>
                {ordinal(d)}
              </option>
            ))}
        </Select>
      </Field>
      <Field label="Second payday" htmlFor={`${id}-2`}>
        <Select
          id={`${id}-2`}
          value={String(second)}
          onChange={(e) => update({ paydays: { ...settings.paydays, second: e.target.value === "last" ? "last" : Number(e.target.value) } })}
        >
          {Array.from({ length: 30 - first }, (_, i) => first + 1 + i).map((d) => (
            <option key={d} value={d}>
              {ordinal(d)}
            </option>
          ))}
          <option value="last">Last day of the month</option>
        </Select>
      </Field>
      <Field label="Monthly basic salary" htmlFor={`${id}-s`} hint="Basis for SSS/PhilHealth/Pag-IBIG. Leave blank to use 2× the cutoff gross.">
        <MoneyInput id={`${id}-s`} value={settings.monthlyBasicSalary} onValueChange={(v) => update({ monthlyBasicSalary: v })} />
      </Field>
    </div>
  );
}
