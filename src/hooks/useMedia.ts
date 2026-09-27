import { useReducedMotion } from "motion/react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useStore } from "@/store/useStore";

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", cb);
      return () => mql.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export const useIsDesktop = () => useMediaQuery("(min-width: 768px)");
export const useFinePointer = () => useMediaQuery("(hover: hover) and (pointer: fine)");

/** True when motion should be reduced (Settings override, else the OS preference). */
export function useReduced(): boolean {
  const pref = useStore((s) => s.settings.motion);
  const system = useReducedMotion() ?? false;
  if (pref === "reduced") return true;
  if (pref === "full") return false;
  return system;
}

/** Debounced copy of a value. */
export function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Resolved theme ("paper" | "workbench"), following the OS when set to "system". */
export function useResolvedTheme(): "paper" | "workbench" {
  const theme = useStore((s) => s.settings.theme);
  const dark = useMediaQuery("(prefers-color-scheme: dark)");
  if (theme === "system") return dark ? "workbench" : "paper";
  return theme;
}
