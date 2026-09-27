import { defaultData } from "./defaults";
import type { AppData } from "./types";
import { DATA_KEYS } from "./types";

export const STORE_VERSION = 2;
export const STORE_KEY = "kinsenas:v1";

type Migration = (state: Record<string, unknown>) => Record<string, unknown>;

/**
 * migrations[n] upgrades a state at version n to version n + 1.
 * Add one entry (and a test) whenever the persisted shape changes, then bump STORE_VERSION.
 */
export const migrations: Record<number, Migration> = {
  // v0 → v1: fill any missing top-level collections with defaults.
  0: (state) => {
    const d = defaultData();
    const out: Record<string, unknown> = { ...state };
    for (const k of DATA_KEYS) if (out[k] === undefined) out[k] = d[k];
    return out;
  },
  // v1 → v2: cutoffs gain an optional `basis` (what they were computed with).
  // It can't be reconstructed for old cutoffs, so they keep editing with current settings.
  1: (state) => state,
};

export function migrate(persisted: unknown, fromVersion: number): AppData {
  let state = (persisted && typeof persisted === "object" ? persisted : {}) as Record<string, unknown>;
  for (let v = fromVersion; v < STORE_VERSION; v++) {
    const m = migrations[v];
    if (m) state = m(state);
  }
  return state as unknown as AppData;
}
