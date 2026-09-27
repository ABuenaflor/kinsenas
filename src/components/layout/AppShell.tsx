import { lazy, Suspense, useEffect } from "react";
import { Toaster } from "@/components/ui/Toast";
import { ExpenseDrawer } from "@/features/expenses/ExpenseDrawer";
import { ItemDrawer } from "@/features/tobuy/ItemDrawer";
import { useReduced } from "@/hooks/useMedia";
import { useStore } from "@/store/useStore";
import { AnimatedOutlet } from "./AnimatedOutlet";
import { CommandPalette } from "./CommandPalette";
import { Dock } from "./Dock";
import { QuickAddFab } from "./QuickAddFab";

const Onboarding = lazy(() => import("@/features/onboarding/Onboarding"));

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
      <CommandPalette />
      <ExpenseDrawer />
      <ItemDrawer />
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
