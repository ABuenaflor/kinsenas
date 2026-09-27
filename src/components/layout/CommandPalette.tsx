import { AnimatePresence, motion } from "motion/react";
import { CornerDownLeft, Gift, Moon, ReceiptText, Search, Wallet, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";
import { LabelTag } from "@/components/ui/diy";
import { toast } from "@/components/ui/Toast";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";
import { todayISO } from "@/lib/periods";
import { quickParse } from "@/lib/quickParse";
import { useStore } from "@/store/useStore";
import { useUi } from "@/store/useUi";
import { NAV } from "./Dock";

interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  run: () => void;
}

function Palette({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const categories = useStore((s) => s.categories);
  const buckets = useStore((s) => s.buckets);
  const openExpense = useUi((s) => s.openExpense);
  const openToBuy = useUi((s) => s.openToBuy);
  useFocusTrap(ref, true, onClose);

  const parsed = useMemo(() => quickParse(q, categories, buckets), [q, categories, buckets]);

  const commands = useMemo<Command[]>(() => {
    const list: Command[] = [];
    if (parsed.amount && parsed.amount > 0) {
      const amount = parsed.amount;
      const cat = parsed.category ?? categories.find((c) => c.id === "cat-others") ?? categories[0];
      const bucket = parsed.bucket ?? buckets.find((b) => b.id === cat?.defaultBucketId) ?? buckets.find((b) => !b.archived);
      if (cat && bucket)
        list.push({
          id: "quick-add",
          label: `Add ${formatMoney(amount)} · ${cat.emoji} ${cat.name} · ${bucket.name}`,
          hint: parsed.note ? `“${parsed.note}” today` : "today",
          icon: ReceiptText,
          run: () => {
            const s = useStore.getState();
            const snap = s.snapshot();
            s.addExpense({ amount, date: todayISO(), categoryId: cat.id, bucketId: bucket.id, note: parsed.note });
            toast(`Added ${formatMoney(amount)} to ${bucket.name}`, { tone: "success", undo: () => useStore.getState().restore(snap) });
          },
        });
    }
    list.push(
      { id: "add-expense", label: "Add expense…", icon: ReceiptText, run: () => openExpense() },
      { id: "log-payday", label: "Log payday", icon: Wallet, run: () => navigate("/", { state: { focusSalary: Date.now() } }) },
      { id: "add-tobuy", label: "Add To-Buy item…", icon: Gift, run: () => openToBuy() },
      ...NAV.map((n) => ({ id: `go-${n.to}`, label: `Go to ${n.label}`, icon: n.icon, run: () => navigate(n.to) })),
      {
        id: "theme",
        label: "Toggle theme",
        icon: Moon,
        run: () => {
          const s = useStore.getState();
          s.updateSettings({ theme: s.settings.theme === "workbench" ? "paper" : "workbench" });
        },
      },
    );
    if (parsed.amount) return list;
    const needle = q.trim().toLowerCase();
    return needle ? list.filter((c) => c.label.toLowerCase().includes(needle)) : list;
  }, [parsed, q, categories, buckets, navigate, openExpense, openToBuy]);

  useEffect(() => setActive(0), [q]);

  const run = (c: Command | undefined) => {
    if (!c) return;
    onClose();
    c.run();
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-[81] flex justify-center px-4 pt-[12vh]">
      <motion.div
        ref={ref}
        data-layer
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        initial={{ opacity: 0, y: -8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.12 } }}
        transition={{ type: "spring", stiffness: 520, damping: 36 }}
        className="card pointer-events-auto h-fit w-full max-w-xl overflow-hidden p-0 shadow-drawer"
      >
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="size-4 text-muted" aria-hidden />
          <input
            autoFocus
            data-autofocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, commands.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                run(commands[active]);
              }
            }}
            placeholder="Jump somewhere, or type “250 lunch wants”"
            aria-label="Command or quick expense"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-activedescendant={commands[active] ? `cmd-${commands[active].id}` : undefined}
            className="min-h-14 w-full bg-transparent text-base outline-none placeholder:text-muted"
          />
          <LabelTag>esc</LabelTag>
        </div>
        <ul id="palette-list" role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
          {commands.map((c, i) => (
            <li
              key={c.id}
              id={`cmd-${c.id}`}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onClick={() => run(c)}
              className={cn(
                "flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-3 text-sm",
                i === active ? "bg-surface-2 text-ink" : "text-muted",
                c.id === "quick-add" && "font-medium text-ink",
              )}
            >
              <c.icon className="size-4 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{c.label}</span>
              {c.hint && <span className="hidden truncate text-xs text-muted sm:inline">{c.hint}</span>}
              {i === active && <CornerDownLeft className="size-3.5 text-muted" aria-hidden />}
            </li>
          ))}
          {commands.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">Nothing matches. Try “250 lunch”.</li>}
        </ul>
      </motion.div>
    </div>
  );
}

export function CommandPalette() {
  const open = useUi((s) => s.paletteOpen);
  const setPalette = useUi((s) => s.setPalette);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette(!useUi.getState().paletteOpen);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setPalette]);
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="bd"
            className="fixed inset-0 z-[80] bg-[rgb(20_19_17/0.3)] backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPalette(false)}
          />
          <Palette key="p" onClose={() => setPalette(false)} />
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
