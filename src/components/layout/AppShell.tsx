import { lazy, Suspense, useEffect, useState } from "react";
import { Toaster } from "@/components/ui/Toast";
import { useReduced } from "@/hooks/useMedia";
import { useStore } from "@/store/useStore";
import { useUi } from "@/store/useUi";
import { AnimatedOutlet } from "./AnimatedOutlet";
import CommandPalette from "./CommandPalette";
import { Dock } from "./Dock";
import { QuickAddFab } from "./QuickAddFab";

const Onboarding = lazy(() => import("@/features/onboarding/Onboarding"));

// Drawers load on first use (prefetched when the browser is idle) to keep the first paint light. The palette is
// small and must take keystrokes the instant Ctrl+K is pressed, so it's bundled with the shell.
const loadExpenseDrawer = () => import("@/features/expenses/ExpenseDrawer");
const loadItemDrawer = () => import("@/features/tobuy/ItemDrawer");
const ExpenseDrawer = lazy(loadExpenseDrawer);
const ItemDrawer = lazy(loadItemDrawer);

/** True once `open` has been true; the overlay then stays mounted so its exit animation can play. */
function useEverOpened(open: boolean): boolean {
  const [ever, setEver] = useState(open);
  if (open && !ever) setEver(true);
  return ever;
}

function useOverlayPrefetch() {
  useEffect(() => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number; cancelIdleCallback?: (id: number) => void };
    const run = () => void Promise.all([loadExpenseDrawer(), loadItemDrawer()]);
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(run);
      return () => w.cancelIdleCallback?.(id);
    }
    const t = setTimeout(run, 1500);
    return () => clearTimeout(t);
  }, []);
}

function usePaletteShortcut() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const ui = useUi.getState();
        ui.setPalette(!ui.paletteOpen);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

export function GrainOverlay() {
  return <div aria-hidden className="grain" />;
}

function useSmoothScroll() {
  const enabled = useStore((s) => s.settings.smoothScroll);
  const reduced = useReduced();
  useEffect(() => {
    if (!enabled || reduced) return;
    let raf = 0;
    let destroy: (() => void) | undefined;
    let cancelled = false;
    void import("lenis").then(({ default: Lenis }) => {
      if (cancelled) return;
      const lenis = new Lenis({ lerp: 0.12 });
      const loop = (t: number) => {
        lenis.raf(t);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
      destroy = () => lenis.destroy();
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      destroy?.();
    };
  }, [enabled, reduced]);
}

export function AppShell() {
  const onboardingDone = useStore((s) => s.settings.onboardingDone);
  const storageOk = useStore((s) => s.ui.storageOk);
  useSmoothScroll();
  useOverlayPrefetch();
  usePaletteShortcut();
  const paletteMounted = useEverOpened(useUi((s) => s.paletteOpen));
  const expenseMounted = useEverOpened(useUi((s) => s.expenseDrawer.open));
  const itemMounted = useEverOpened(useUi((s) => s.toBuyDrawer.open));
  return (
    <div className="grid-bg relative min-h-dvh">
      <a href="#main" className="sr-only-focusable card px-4 py-2 text-sm font-medium">
        Skip to content
      </a>
      <Dock />
      {!storageOk && (
        <div role="status" className="relative z-30 bg-highlight px-4 py-2 text-center text-sm text-[#1a1916] md:fixed md:inset-x-0 md:bottom-0">
          Data won't be saved in this browser mode.
        </div>
      )}
      <div className="mx-auto w-full max-w-[1200px] px-4 pb-40 pt-6 md:px-6 md:pb-24 md:pt-28 lg:px-10">
        <AnimatedOutlet />
      </div>
      <QuickAddFab />
      {/* Separate boundaries so one overlay loading never blanks another that's open. */}
      {paletteMounted && <CommandPalette />}
      <Suspense fallback={null}>{expenseMounted && <ExpenseDrawer />}</Suspense>
      <Suspense fallback={null}>{itemMounted && <ItemDrawer />}</Suspense>
      <Toaster />
      <GrainOverlay />
      {!onboardingDone && (
        <Suspense fallback={null}>
          <Onboarding />
        </Suspense>
      )}
    </div>
  );
}
