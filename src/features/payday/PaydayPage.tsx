import { AnimatePresence, m, useAnimationControls } from "motion/react";
import { useEffect, useState } from "react";
import { PeriodSwitcher } from "@/components/layout/PeriodSwitcher";
import { Hero3D } from "@/components/three/Hero3D";
import { SectionTitle } from "@/components/ui/Card";
import { HandStroke, Stamp } from "@/components/ui/diy";
import { Envelope } from "@/components/ui/Envelope";
import { BlurHeading } from "@/components/ui/misc";
import { toast } from "@/components/ui/Toast";
import { useReduced } from "@/hooks/useMedia";
import { formatMoney, ratio } from "@/lib/money";
import { halfLabel, nextPayday, parseCutoffId, payDateOf, shortDate, todayISO } from "@/lib/periods";
import { useStore } from "@/store/useStore";
import { useUi } from "@/store/useUi";
import { CutoffInputCard } from "./CutoffInputCard";
import { History } from "./History";
import { Receipt } from "./Receipt";
import { useCutoffDraft } from "./useCutoffDraft";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Magandang umaga";
  if (h < 18) return "Magandang hapon";
  return "Magandang gabi";
}

function HeroStrip() {
  const paydays = useStore((s) => s.settings.paydays);
  const next = nextPayday(todayISO(), paydays);
  const kind = parseCutoffId(next.id).half === "A" ? "kinsenas" : "katapusan";
  const line = next.inDays === 0 ? "Sahod day! 🎉" : next.inDays === 1 ? `Next ${kind} is tomorrow` : `Next ${kind} in ${next.inDays} days`;
  return (
    <section className="mb-8 flex items-center justify-between gap-6">
      <div>
        <p className="eyebrow mb-3">{greeting()}</p>
        <BlurHeading text={line} className="text-4xl md:text-6xl" />
        <div className="relative mt-2 inline-block text-sm text-muted">
          {shortDate(next.date)} · {halfLabel(parseCutoffId(next.id).half, paydays)} payday
          <HandStroke kind="underline" className="absolute -bottom-2 left-0 h-2.5 w-full" delay={0.8} />
        </div>
      </div>
      <div className="hidden shrink-0 md:block">
        <Hero3D />
      </div>
    </section>
  );
}

export default function PaydayPage() {
  const { draft, update, preview, debouncedGross, existing, setAsides, dirty } = useCutoffDraft();
  const paydays = useStore((s) => s.settings.paydays);
  const fireSave = useUi((s) => s.fireSave);
  const reduced = useReduced();
  const shakeControls = useAnimationControls();
  const [stampKey, setStampKey] = useState(0);

  useEffect(() => {
    if (!stampKey) return;
    const t = setTimeout(() => setStampKey(0), 2400);
    return () => clearTimeout(t);
  }, [stampKey]);

  const save = () => {
    if (draft.gross === null) return;
    const s = useStore.getState();
    const snap = s.snapshot();
    const { cutoff, setAside, created } = s.saveCutoff({
      cutoffId: draft.cutoffId,
      gross: draft.gross,
      govAlreadyDeducted: draft.govAlreadyDeducted,
      ruleId: draft.ruleId,
      adjustments: draft.adjustments.extras.length || Object.keys(draft.adjustments.overrides).length ? draft.adjustments : undefined,
      note: draft.note,
    });
    setStampKey(Date.now());
    fireSave();
    if (!reduced) void shakeControls.start({ x: [0, -2, 2, -1, 0], transition: { duration: 0.28, delay: 0.12 } });
    const extra = setAside > 0 ? ` · ${formatMoney(setAside)} set aside` : "";
    toast(`${created ? "Saved" : "Updated"} ${shortDate(cutoff.payDate)} cutoff · ${formatMoney(cutoff.net)} net${extra}`, {
      tone: "success",
      undo: () => useStore.getState().restore(snap),
    });
  };

  const netForEnvelopes = Math.max(0, preview.net);
  const { half } = parseCutoffId(draft.cutoffId);

  return (
    <div>
      <HeroStrip />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Log a cutoff</h2>
        <PeriodSwitcher />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <CutoffInputCard draft={draft} update={update} preview={preview} editing={!!existing} legacy={!!existing && !existing.basis} dirty={dirty} onSave={save} />
        <m.div animate={shakeControls} className="lg:sticky lg:top-28">
          <Receipt
            title={`${halfLabel(half, paydays)} cutoff`}
            subtitle={`${shortDate(payDateOf(draft.cutoffId, paydays))} · ${preview.rule?.name ?? ""}`}
            gross={debouncedGross}
            deductions={preview.deductions}
            net={preview.net}
            allocations={preview.allocations}
            setAsides={setAsides}
            govAlreadyDeducted={draft.govAlreadyDeducted}
            printKey={`${draft.cutoffId}-${debouncedGross > 0}`}
            circleNet={stampKey > 0}
            overlay={
              <AnimatePresence>
                {stampKey > 0 && <Stamp key={stampKey} label="PAID ✓" sub={shortDate(payDateOf(draft.cutoffId, paydays))} className="right-6 top-24" />}
              </AnimatePresence>
            }
          />
        </m.div>
      </div>

      <section className="mt-10" aria-label="Envelopes">
        <SectionTitle eyebrow="Envelopes" title="Where this cutoff goes" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {preview.allocations.map((a) => (
            <Envelope
              key={a.bucketId}
              name={a.name}
              color={a.color}
              amount={a.amount}
              fill={ratio(a.amount, netForEnvelopes)}
              share={netForEnvelopes > 0 ? Math.round(ratio(a.amount, netForEnvelopes) * 10000) : 0}
              caption={a.countsAsSavings ? "Counts as savings" : undefined}
            />
          ))}
        </div>
      </section>

      <History />
    </div>
  );
}
