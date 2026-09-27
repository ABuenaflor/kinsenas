import { AnimatePresence, m } from "motion/react";
import { Suspense, useState } from "react";
import { useLocation, useOutlet } from "react-router";
import { PageSkeleton } from "@/components/ui/misc";
import { useReduced } from "@/hooks/useMedia";

/** Keeps the outlet that was current when this page mounted, so exiting pages don't re-render with new route data. */
function Frozen() {
  const o = useOutlet();
  const [f] = useState(o);
  return f;
}

export function AnimatedOutlet() {
  const { pathname } = useLocation();
  const reduced = useReduced();
  return (
    <AnimatePresence mode="wait" initial={false} onExitComplete={() => window.scrollTo({ top: 0 })}>
      <m.main
        id="main"
        key={pathname}
        tabIndex={-1}
        className="outline-none"
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12, filter: "blur(6px)" }}
        animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, filter: "blur(0px)" }}
        exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8, filter: "blur(4px)" }}
        transition={{ duration: reduced ? 0.15 : 0.28, ease: [0.22, 1, 0.36, 1] }}
      >
        <Suspense fallback={<PageSkeleton />}>
          <Frozen />
        </Suspense>
      </m.main>
    </AnimatePresence>
  );
}
