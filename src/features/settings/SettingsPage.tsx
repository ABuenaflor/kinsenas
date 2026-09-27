import { PageHeader } from "@/components/layout/PeriodSwitcher";
import { Section } from "./Section";
import { AppearanceEditor, DataEditor } from "./sections/AppearanceData";
import { BucketsEditor, RulesEditor } from "./sections/BucketsRules";
import { CategoriesEditor } from "./sections/Categories";
import { CustomDeductionsEditor } from "./sections/CustomDeductions";
import { GovDeductionsEditor } from "./sections/GovDeductions";
import { PaydayFields } from "./sections/Paydays";
import { RatesEditor } from "./sections/Rates";

const SECTIONS = [
  { id: "paydays", title: "Paydays & salary" },
  { id: "gov", title: "Government deductions" },
  { id: "rates", title: "Rates (advanced)" },
  { id: "custom", title: "Custom deductions" },
  { id: "buckets", title: "Buckets & allocation rules" },
  { id: "categories", title: "Categories" },
  { id: "appearance", title: "Appearance & motion" },
  { id: "data", title: "Data" },
];

export default function SettingsPage() {
  return (
    <div>
      <PageHeader eyebrow="Settings" title="Your rules, your way" />
      <div className="grid items-start gap-8 md:grid-cols-[13rem_minmax(0,1fr)]">
        <nav aria-label="Settings sections" className="sticky top-28 hidden md:block">
          <ul className="space-y-0.5 border-l border-line">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="-ml-px flex min-h-10 items-center border-l-2 border-transparent pl-4 text-sm text-muted transition-colors hover:border-ink hover:text-ink">
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0 space-y-4">
          <Section id="paydays" title="Paydays & salary" description="When your kinsenas and katapusan land.">
            <PaydayFields />
          </Section>
          <Section id="gov" title="Government deductions" description="Previews use your monthly basic salary.">
            <GovDeductionsEditor />
          </Section>
          <Section id="rates" title="Rates (advanced)">
            <RatesEditor />
          </Section>
          <Section id="custom" title="Custom deductions" description="Applied after government deductions, in this order.">
            <CustomDeductionsEditor />
          </Section>
          <Section id="buckets" title="Buckets & allocation rules" description="Buckets are your envelopes. Rules decide how net pay fills them.">
            <BucketsEditor />
            <div className="mt-8 border-t border-line pt-6">
              <h3 className="mb-4 font-semibold">Allocation rules</h3>
              <RulesEditor />
            </div>
          </Section>
          <Section id="categories" title="Categories" description="Used categories are archived instead of deleted.">
            <CategoriesEditor />
          </Section>
          <Section id="appearance" title="Appearance & motion">
            <AppearanceEditor />
          </Section>
          <Section id="data" title="Data" description="Everything lives in this browser. Export a backup now and then.">
            <DataEditor />
          </Section>
        </div>
      </div>
    </div>
  );
}
