import { AnimatePresence, m } from "motion/react";
import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Button, MagneticButton } from "@/components/ui/Button";
import { HandStroke, TapeLabel } from "@/components/ui/diy";
import { validateRule } from "@/domain/allocation";
import type { AllocationRule } from "@/domain/types";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useReduced } from "@/hooks/useMedia";
import { cn } from "@/lib/cn";
import { useActiveBuckets } from "@/store/selectors";
import { useStore } from "@/store/useStore";
import { RuleEditor } from "@/features/settings/RuleEditor";
import { CustomDeductionsEditor } from "@/features/settings/sections/CustomDeductions";
import { GovDeductionsEditor } from "@/features/settings/sections/GovDeductions";
import { PaydayFields } from "@/features/settings/sections/Paydays";

const STEPS = ["When do you get paid?", "What gets deducted?", "How do you split your pay?"];

export default function Onboarding() {
  const ref = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const reduced = useReduced();
  const navigate = useNavigate();
  const update = useStore((s) => s.updateSettings);
  const upsertRule = useStore((s) => s.upsertRule);
  const activeRule = useStore((s) => s.rules.find((r) => r.id === s.settings.activeRuleId) ?? s.rules[0]);
  const monthly = useStore((s) => s.settings.monthlyBasicSalary);
  const buckets = useActiveBuckets();
  const [rule, setRule] = useState<AllocationRule | undefined>(activeRule);
  const ruleOk = !rule || validateRule(rule, buckets).ok;

  const finish = (useDefaults = false) => {
    if (!useDefaults && rule && ruleOk) upsertRule(rule);
    update({ onboardingDone: true });
    navigate("/", { state: { focusSalary: true } });
  };
  useFocusTrap(ref, true, () => finish(true));

  const go = (d: number) => {
    setDir(d);
    setStep((s) => s + d);
  };

  return (
    <div className="grid-bg fixed inset-0 z-[75] overflow-y-auto bg-bg">
      <div className="flex min-h-full items-start justify-center px-4 py-8 md:items-center">
        <m.div
          ref={ref}
          data-layer
          role="dialog"
          aria-modal="true"
          aria-labelledby="onb-title"
          initial={{ opacity: 0.4, y: 16 }} // visible from the first frame (LCP), then settles
          animate={{ opacity: 1, y: 0 }}
          className="card relative w-full max-w-2xl p-6 md:p-10"
        >
          <div className="mb-6 flex items-center justify-between gap-3">
            <TapeLabel seed="onboarding">Kinsenas · setup</TapeLabel>
            <Button variant="ghost" size="sm" onClick={() => finish(true)}>
              Use defaults
            </Button>
          </div>
          <ol className="mb-6 flex gap-2" aria-label="Progress">
            {STEPS.map((s, i) => (
              <li key={s} className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2" aria-current={i === step ? "step" : undefined}>
                <span className="sr-only">
                  Step {i + 1}: {s}
                </span>
                <m.span className="block h-full origin-left bg-ink" initial={false} animate={{ scaleX: i <= step ? 1 : 0 }} transition={{ type: "spring", stiffness: 300, damping: 30 }} />
              </li>
            ))}
          </ol>
          <AnimatePresence mode="wait" initial={false} custom={dir}>
            <m.div
              key={step}
              initial={reduced ? { opacity: 0 } : { opacity: 0, x: 24 * dir, filter: "blur(4px)" }}
              animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, x: -24 * dir, filter: "blur(4px)" }}
              transition={{ duration: 0.25 }}
            >
              <p className="eyebrow mb-2">
                Step {step + 1} of {STEPS.length}
              </p>
              <h1 id="onb-title" className="relative mb-6 inline-block font-display text-4xl leading-tight md:text-5xl">
                {STEPS[step]}
                {step === 0 && <HandStroke className="absolute -bottom-2 left-0 h-3 w-full" delay={0.4} />}
              </h1>
              {step === 0 && (
                <div className="space-y-3">
                  <PaydayFields />
                  <p className="text-sm text-muted">Most PH payrolls pay on the 15th and the last day of the month.</p>
                </div>
              )}
              {step === 1 && (
                <div className="space-y-6">
                  {monthly === null && <p className="text-sm text-muted">Tip: add your monthly basic salary in step 1 to see live previews.</p>}
                  <GovDeductionsEditor />
                  <div>
                    <p className="mb-2 text-sm font-medium">Loans, insurance, co-op?</p>
                    <CustomDeductionsEditor />
                  </div>
                </div>
              )}
              {step === 2 && rule && <RuleEditor rule={rule} onChange={setRule} buckets={buckets} sampleNet={monthly ? Math.round(monthly / 2) : 1000000} />}
            </m.div>
          </AnimatePresence>
          <div className="mt-8 flex items-center justify-between gap-3">
            <Button variant="ghost" onClick={() => go(-1)} className={cn(step === 0 && "invisible")}>
              Back
            </Button>
            {step < STEPS.length - 1 ? (
              <MagneticButton onClick={() => go(1)}>Next</MagneticButton>
            ) : (
              <MagneticButton variant="highlight" disabled={!ruleOk} onClick={() => finish()}>
                Start budgeting →
              </MagneticButton>
            )}
          </div>
        </m.div>
      </div>
    </div>
  );
}
