import { Download, FlaskConical, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { SegmentedControl, Switch } from "@/components/ui/inputs";
import { ConfirmDialog, Dialog } from "@/components/ui/overlays";
import { toast } from "@/components/ui/Toast";
import { downloadFile, toCsv } from "@/lib/csv";
import { todayISO } from "@/lib/periods";
import { makeExport, parseImport, type ExportFile } from "@/store/schema";
import { pickData, useStore } from "@/store/useStore";

export function AppearanceEditor() {
  const settings = useStore((s) => s.settings);
  const update = useStore((s) => s.updateSettings);
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-sm font-medium">Theme</p>
        <SegmentedControl
          label="Theme"
          layoutId="set-theme"
          value={settings.theme}
          onChange={(t) => update({ theme: t })}
          options={[
            { value: "paper", label: "Paper" },
            { value: "workbench", label: "Workbench" },
            { value: "system", label: "System" },
          ]}
        />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">Motion</p>
        <SegmentedControl
          label="Motion"
          layoutId="set-motion"
          value={settings.motion}
          onChange={(m) => update({ motion: m })}
          options={[
            { value: "system", label: "System" },
            { value: "reduced", label: "Reduced" },
            { value: "full", label: "Full" },
          ]}
        />
      </div>
      <Switch checked={settings.smoothScroll} onCheckedChange={(v) => update({ smoothScroll: v })} label="Smooth scroll" description="Turns off automatically with reduced motion." />
      <Switch checked={settings.show3D} onCheckedChange={(v) => update({ show3D: v })} label="3D hero on Payday" description="Desktop only; skipped on slower devices." />
    </div>
  );
}

export function DataEditor() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<ExportFile | null>(null);
  const [mergeSettings, setMergeSettings] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmDemo, setConfirmDemo] = useState(false);
  const replaceData = useStore((s) => s.replaceData);
  const mergeData = useStore((s) => s.mergeData);
  const resetAll = useStore((s) => s.resetAll);
  const loadDemo = useStore((s) => s.loadDemo);

  const exportJson = () => {
    const file = makeExport(pickData(useStore.getState()), new Date().toISOString());
    downloadFile(`kinsenas-backup-${todayISO()}.json`, JSON.stringify(file, null, 2), "application/json");
  };
  const exportCsv = () => {
    const s = useStore.getState();
    const cat = new Map(s.categories.map((c) => [c.id, c.name]));
    const bucket = new Map(s.buckets.map((b) => [b.id, b.name]));
    const rows = [...s.expenses]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((e) => [e.date, e.cutoffId, cat.get(e.categoryId) ?? e.categoryId, bucket.get(e.bucketId) ?? e.bucketId, (e.amount / 100).toFixed(2), e.note ?? ""]);
    downloadFile(`kinsenas-expenses-${todayISO()}.csv`, toCsv(["Date", "Pay period", "Category", "Bucket", "Amount (PHP)", "Note"], rows), "text/csv;charset=utf-8");
  };
  const onFile = async (f: File | undefined) => {
    if (!f) return;
    const r = parseImport(await f.text());
    if (fileRef.current) fileRef.current.value = "";
    if (!r.ok) toast(`Import failed — ${r.error}`, { tone: "danger" });
    else setPending(r.file);
  };
  const apply = (mode: "replace" | "merge") => {
    if (!pending) return;
    const snap = useStore.getState().snapshot();
    if (mode === "replace") replaceData(pending.data);
    else mergeData(pending.data, { includeSettings: mergeSettings });
    setPending(null);
    toast(mode === "replace" ? "Data replaced from backup" : "Backup merged", { tone: "success", undo: () => useStore.getState().restore(snap) });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={exportJson}>
          <Download className="size-4" /> Export all (JSON)
        </Button>
        <Button variant="outline" onClick={() => fileRef.current?.click()}>
          <Upload className="size-4" /> Import JSON
        </Button>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} aria-hidden tabIndex={-1} />
        <Button variant="outline" onClick={exportCsv}>
          <Download className="size-4" /> Export expenses (CSV)
        </Button>
        <Button variant="outline" onClick={() => setConfirmDemo(true)}>
          <FlaskConical className="size-4" /> Load demo data
        </Button>
      </div>
      <div className="border-t border-line pt-3">
        <Button variant="danger" onClick={() => setConfirmReset(true)}>
          <Trash2 className="size-4" /> Reset everything
        </Button>
      </div>

      <Dialog
        open={!!pending}
        onClose={() => setPending(null)}
        title="Import this backup?"
        description={pending && `Exported ${new Date(pending.exportedAt).toLocaleString("en-PH")}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button variant="outline" onClick={() => apply("merge")}>
              Merge
            </Button>
            <Button onClick={() => apply("replace")}>Replace</Button>
          </>
        }
      >
        {pending && (
          <ul className="money grid grid-cols-2 gap-1 text-sm">
            <li>{pending.data.cutoffs.length} cutoffs</li>
            <li>{pending.data.expenses.length} expenses</li>
            <li>{pending.data.toBuy.length} To-Buy items</li>
            <li>{pending.data.categories.length} categories</li>
            <li>{pending.data.buckets.length} buckets</li>
            <li>{pending.data.rules.length} rules</li>
          </ul>
        )}
        <Switch
          className="mt-4"
          checked={mergeSettings}
          onCheckedChange={setMergeSettings}
          label="When merging, also use its settings"
          description="Paydays, monthly salary, rates and government deduction settings. Replace always uses them."
        />
      </Dialog>
      <ConfirmDialog
        open={confirmDemo}
        onClose={() => setConfirmDemo(false)}
        tone="solid"
        confirmLabel="Load demo"
        title="Load demo data?"
        description="This replaces your current data with 6 months of sample paydays and expenses. You can undo right after."
        onConfirm={() => {
          const snap = useStore.getState().snapshot();
          loadDemo();
          toast("Demo data loaded", { undo: () => useStore.getState().restore(snap) });
        }}
      />
      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        requireText="RESET"
        confirmLabel="Erase everything"
        title="Reset everything?"
        description="All cutoffs, expenses, To-Buy items and settings will be erased from this browser. Export a backup first if you might want them."
        onConfirm={() => {
          resetAll();
          toast("Everything was reset");
        }}
      />
    </div>
  );
}
