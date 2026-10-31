import { Pencil, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { toast } from "@/components/ui/Toast";
import { useStore } from "@/store/useStore";

const MAX = 1000;

const when = (iso: string) => new Date(iso).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** Free-text notes under By category: type, Save or Cancel; saved ones can be edited or deleted. */
export function Remarks() {
  const id = useId();
  const remarks = useStore((s) => s.remarks);
  const [text, setText] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const trimmed = text.trim();

  const cancel = () => {
    setText("");
    setEditing(null);
  };
  const save = () => {
    if (!trimmed) return;
    const s = useStore.getState();
    if (editing) s.updateRemark(editing, trimmed);
    else s.addRemark(trimmed);
    toast(editing ? "Remark updated" : "Remark saved", { tone: "success" });
    cancel();
  };
  const remove = (rid: string) => {
    const snap = useStore.getState().snapshot();
    useStore.getState().removeRemark(rid);
    if (editing === rid) cancel();
    toast("Remark deleted", { undo: () => useStore.getState().restore(snap) });
  };

  return (
    <Card>
      <label htmlFor={`${id}-text`} className="eyebrow mb-3 block">
        Remarks
      </label>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <textarea
          id={`${id}-text`}
          value={text}
          maxLength={MAX}
          rows={3}
          placeholder="Add a remark, e.g. lots of Grab rides this week"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save();
            if (e.key === "Escape") cancel();
          }}
          className="field min-h-24 w-full resize-y py-2"
        />
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={cancel} disabled={!text && !editing}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={!trimmed}>
            {editing ? "Save changes" : "Save"}
          </Button>
        </div>
      </form>

      {remarks.length > 0 && (
        <ul className="mt-4 space-y-3 border-t border-line pt-4">
          {[...remarks].reverse().map((r) => (
            <li key={r.id} className="group text-sm">
              <p className="whitespace-pre-wrap break-words">{r.text}</p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="text-xs text-muted">
                  {when(r.createdAt)}
                  {r.updatedAt && " · edited"}
                </span>
                <span className="flex">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Edit remark"
                    onClick={() => {
                      setEditing(r.id);
                      setText(r.text);
                      document.getElementById(`${id}-text`)?.focus();
                    }}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="Delete remark" onClick={() => remove(r.id)}>
                    <Trash2 className="size-4" />
                  </Button>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
