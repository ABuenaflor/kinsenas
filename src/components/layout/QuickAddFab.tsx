import { AnimatePresence, m } from "motion/react";
import { Gift, Plus, ReceiptText, Wallet } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { cn } from "@/lib/cn";
import { useUi } from "@/store/useUi";

/** Speed dial: + Expense / + Payday / + To-Buy. */
export function QuickAddFab() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const openExpense = useUi((s) => s.openExpense);
  const openToBuy = useUi((s) => s.openToBuy);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const actions = [
    { label: "Expense", icon: ReceiptText, run: () => openExpense() },
    { label: "Payday", icon: Wallet, run: () => navigate("/", { state: { focusSalary: true } }) },
    { label: "To-Buy", icon: Gift, run: () => openToBuy() },
  ];

  return (
    <div ref={ref} className="fixed bottom-[calc(96px+env(safe-area-inset-bottom))] right-4 z-50 flex flex-col items-end gap-2 md:bottom-8 md:right-8">
      <AnimatePresence>
        {open && (
          <m.ul
            id="quick-add-menu"
            className="flex flex-col items-end gap-2"
            initial="hidden"
            animate="show"
            exit="hidden"
            variants={{ hidden: { transition: { staggerChildren: 0.03, staggerDirection: -1 } }, show: { transition: { staggerChildren: 0.04, staggerDirection: -1 } } }}
          >
            {actions.map((a) => (
              <m.li
                key={a.label}
                variants={{ hidden: { opacity: 0, y: 12, scale: 0.9 }, show: { opacity: 1, y: 0, scale: 1 } }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    a.run();
                  }}
                  className="card flex min-h-11 items-center gap-2 rounded-full py-2 pl-3 pr-4 text-sm font-medium shadow-drawer hover:bg-surface-2"
                >
                  <a.icon className="size-4" aria-hidden />+ {a.label}
                </button>
              </m.li>
            ))}
          </m.ul>
        )}
      </AnimatePresence>
      <m.button
        type="button"
        aria-label={open ? "Close quick add" : "Quick add"}
        aria-expanded={open}
        aria-controls="quick-add-menu"
        onClick={() => setOpen((o) => !o)}
        whileTap={{ scale: 0.92 }}
        className={cn("grid size-14 place-items-center rounded-full bg-highlight text-[#1a1916] shadow-drawer", open && "bg-accent text-accent-ink")}
      >
        <m.span animate={{ rotate: open ? 45 : 0 }} transition={{ type: "spring", stiffness: 500, damping: 25 }}>
          <Plus className="size-6" strokeWidth={2.4} />
        </m.span>
      </m.button>
    </div>
  );
}
