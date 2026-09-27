import Spline from "@splinetool/react-spline";
import type { Application } from "@splinetool/runtime";
import { useEffect, useRef } from "react";

/** Interactive Spline scene; emits the "Coin" mouseDown event whenever a cutoff is saved. */
export default function SplineHero({ scene, saveSignal }: { scene: string; saveSignal: number }) {
  const app = useRef<Application | null>(null);
  useEffect(() => {
    if (!saveSignal || !app.current) return;
    try {
      if (app.current.findObjectByName("Coin")) app.current.emitEvent("mouseDown", "Coin");
    } catch {
      /* scene without a Coin object */
    }
  }, [saveSignal]);
  return (
    <div className="h-56 w-full md:h-64" aria-hidden>
      <Spline scene={scene} onLoad={(a) => (app.current = a)} />
    </div>
  );
}
