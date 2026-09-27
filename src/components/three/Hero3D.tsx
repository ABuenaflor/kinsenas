import { lazy, Suspense, useEffect, useState } from "react";
import { useMediaQuery, useReduced } from "@/hooks/useMedia";
import { useStore } from "@/store/useStore";
import { useUi } from "@/store/useUi";
import { CoinFallback } from "./CoinFallback";

const SplineHero = lazy(() => import("./SplineHero"));
const SCENE = import.meta.env.VITE_SPLINE_SCENE_URL as string | undefined;

/** Idle-loaded 3D hero; never blocks first paint. Hidden when disabled, reduced motion, small screens, or weak CPUs. */
export function Hero3D() {
  const show3D = useStore((s) => s.settings.show3D);
  const reduced = useReduced();
  const wide = useMediaQuery("(min-width: 768px)");
  const saveSignal = useUi((s) => s.saveSignal);
  const [idle, setIdle] = useState(false);
  const capable = typeof navigator === "undefined" || (navigator.hardwareConcurrency ?? 4) >= 4;

  useEffect(() => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number; cancelIdleCallback?: (id: number) => void };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(() => setIdle(true));
      return () => w.cancelIdleCallback?.(id);
    }
    const t = setTimeout(() => setIdle(true), 600);
    return () => clearTimeout(t);
  }, []);

  if (!show3D || reduced || !wide || !capable || !idle) return null;
  if (!SCENE) return <CoinFallback saveSignal={saveSignal} />;
  return (
    <Suspense fallback={<CoinFallback saveSignal={saveSignal} />}>
      <SplineHero scene={SCENE} saveSignal={saveSignal} />
    </Suspense>
  );
}
