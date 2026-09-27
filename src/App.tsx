import { LazyMotion, MotionConfig } from "motion/react";
import { useEffect } from "react";
import { RouterProvider } from "react-router";
import { useResolvedTheme } from "@/hooks/useMedia";
import { router } from "@/router";
import { useStore } from "@/store/useStore";

function useThemeAttribute() {
  const theme = useResolvedTheme();
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "workbench" ? "#0B0B0C" : "#F6F3EC");
  }, [theme]);
}

// Motion's features load after first paint; components render immediately and start animating once they arrive.
const loadMotionFeatures = () => import("@/motion/features").then((r) => r.default);

export function App() {
  useThemeAttribute();
  const motionPref = useStore((s) => s.settings.motion);
  const reducedMotion = motionPref === "reduced" ? "always" : motionPref === "full" ? "never" : "user";
  return (
    <LazyMotion features={loadMotionFeatures}>
      <MotionConfig reducedMotion={reducedMotion}>
        <RouterProvider router={router} />
      </MotionConfig>
    </LazyMotion>
  );
}
