import { useEffect, useMemo, useState } from "react";
import { plannedSetAsides } from "@/domain/toBuy";
import type { Centavos, CutoffAdjustments, CutoffId } from "@/domain/types";
import { useDebounced } from "@/hooks/useMedia";
import { useCutoffPreview } from "@/store/selectors";
import { useStore } from "@/store/useStore";

const EMPTY_ADJ: CutoffAdjustments = { overrides: {}, extras: [] };

export interface CutoffDraft {
  cutoffId: CutoffId;
  gross: Centavos | null;
  govAlreadyDeducted: boolean;
  ruleId: string;
  note: string;
  adjustments: CutoffAdjustments;
}

/** Draft state for the Payday input card; follows the shared period and loads an existing cutoff for editing. */
export function useCutoffDraft() {
  const period = useStore((s) => s.ui.period);
  const existing = useStore((s) => s.cutoffs.find((c) => c.id === period));
  const activeRuleId = useStore((s) => s.settings.activeRuleId);
  const toBuy = useStore((s) => s.toBuy);

  const fromExisting = (): CutoffDraft => ({
    cutoffId: period,
    gross: existing?.gross ?? null,
    govAlreadyDeducted: existing?.govAlreadyDeducted ?? false,
    ruleId: existing?.ruleId ?? activeRuleId,
    note: existing?.note ?? "",
    adjustments: existing?.adjustments ?? EMPTY_ADJ,
  });
  const [draft, setDraft] = useState<CutoffDraft>(fromExisting);

  // Reload when the period changes or the stored cutoff changes underneath us (undo, re-apply).
  const existingStamp = existing?.updatedAt ?? "none";
  useEffect(() => {
    setDraft(fromExisting());
  }, [period, existingStamp]); // fromExisting reads the latest render's values

  const gross = draft.gross ?? 0;
  const debouncedGross = useDebounced(gross, 150);
  const preview = useCutoffPreview({
    cutoffId: draft.cutoffId,
    gross: debouncedGross,
    govAlreadyDeducted: draft.govAlreadyDeducted,
    ruleId: draft.ruleId,
    adjustments: draft.adjustments,
  });

  const setAsides = useMemo(() => {
    if (existing) {
      return toBuy.flatMap((t) =>
        t.contributions.filter((c) => c.auto && c.cutoffId === existing.id).map((c) => ({ name: t.name, amount: c.amount })),
      );
    }
    return plannedSetAsides(toBuy, preview.allocations).map((p) => ({ name: p.name, amount: p.amount }));
  }, [existing, toBuy, preview.allocations]);

  const update = (patch: Partial<CutoffDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const dirty =
    !existing ||
    existing.gross !== draft.gross ||
    existing.govAlreadyDeducted !== draft.govAlreadyDeducted ||
    existing.ruleId !== draft.ruleId ||
    (existing.note ?? "") !== draft.note ||
    JSON.stringify(existing.adjustments ?? EMPTY_ADJ) !== JSON.stringify(draft.adjustments);

  return { draft, update, preview, debouncedGross, existing, setAsides, dirty };
}
