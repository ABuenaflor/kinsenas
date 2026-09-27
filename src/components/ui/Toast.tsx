import { AnimatePresence, m } from "motion/react";
import { Check, Undo2, X } from "lucide-react";
import { useEffect } from "react";
import { create } from "zustand";
import { newId } from "@/lib/ids";

interface ToastItem {
  id: string;
  message: string;
  tone: "default" | "success" | "danger";
  undo?: () => void;
}

interface ToastStore {
  toasts: ToastItem[];
  push: (t: Omit<ToastItem, "id" | "tone"> & { tone?: ToastItem["tone"] }) => string;
  dismiss: (id: string) => void;
}

export const useToasts = create<ToastStore>((set) => ({
  toasts: [],
  push: (t) => {
    const id = newId();
    set((s) => ({ toasts: [...s.toasts.slice(-2), { tone: "default", ...t, id }] }));
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = (message: string, opts: { undo?: () => void; tone?: ToastItem["tone"] } = {}) =>
  useToasts.getState().push({ message, ...opts });

function ToastRow({ t }: { t: ToastItem }) {
  const dismiss = useToasts((s) => s.dismiss);
  useEffect(() => {
    const timer = setTimeout(() => dismiss(t.id), t.undo ? 6500 : 4000);
    return () => clearTimeout(timer);
  }, [t.id, t.undo, dismiss]);
  return (
    <m.li
      layout
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.96, transition: { duration: 0.15 } }}
      transition={{ type: "spring", stiffness: 500, damping: 34 }}
      className="pointer-events-auto flex min-h-12 w-full max-w-md items-center gap-3 rounded-full bg-accent py-1.5 pl-4 pr-1.5 text-sm text-accent-ink shadow-drawer"
    >
      {t.tone === "success" && <Check className="size-4 shrink-0 text-highlight" aria-hidden />}
      <span className="min-w-0 flex-1">{t.message}</span>
      {t.undo && (
        <button
          type="button"
          className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-highlight px-3.5 font-semibold text-[#1a1916]"
          onClick={() => {
            t.undo?.();
            dismiss(t.id);
          }}
        >
          <Undo2 className="size-4" aria-hidden /> Undo
        </button>
      )}
      <button type="button" aria-label="Dismiss" className="grid size-10 place-items-center rounded-full opacity-70 hover:opacity-100" onClick={() => dismiss(t.id)}>
        <X className="size-4" />
      </button>
    </m.li>
  );
}

export function Toaster() {
  const toasts = useToasts((s) => s.toasts);
  return (
    <div aria-live="polite" aria-atomic="false" className="pointer-events-none fixed inset-x-0 bottom-[calc(88px+env(safe-area-inset-bottom))] z-[90] flex justify-center px-4 md:bottom-6">
      <ul className="flex w-full flex-col items-center gap-2">
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <ToastRow key={t.id} t={t} />
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}
