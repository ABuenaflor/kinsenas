export const routeLoaders = {
  "/": () => import("@/features/payday/PaydayPage"),
  "/expenses": () => import("@/features/expenses/ExpensesPage"),
  "/to-buy": () => import("@/features/tobuy/ToBuyPage"),
  "/insights": () => import("@/features/insights/InsightsPage"),
  "/settings": () => import("@/features/settings/SettingsPage"),
} as const;

export type RoutePath = keyof typeof routeLoaders;

const loaded = new Set<string>();

/** Warm a route chunk on nav hover/focus so transitions never wait on a download. */
export function prefetchRoute(path: string) {
  if (loaded.has(path) || !(path in routeLoaders)) return;
  loaded.add(path);
  void routeLoaders[path as RoutePath]();
}
