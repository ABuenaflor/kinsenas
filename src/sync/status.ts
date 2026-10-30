import { create } from "zustand";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_KEY as string | undefined;

export const syncConfig = url && key ? { url, key } : null;

export type SyncState = "loading" | "signedOut" | "idle" | "syncing" | "offline" | "error";

interface SyncStatus {
  state: SyncState;
  email: string | null;
  lastSyncedAt: number | null;
  error: string | null;
}

/** Tiny, always-loaded status store; the Supabase engine itself loads on demand. */
export const useSyncStatus = create<SyncStatus>(() => ({ state: "loading", email: null, lastSyncedAt: null, error: null }));

let engine: Promise<typeof import("./engine")> | null = null;

/** Load and start the sync engine (idempotent). Resolves to null when sync isn't configured. */
export function loadSync() {
  if (!syncConfig) return Promise.resolve(null);
  engine ??= import("./engine").then((m) => {
    m.start(syncConfig);
    return m;
  });
  return engine;
}

/** Called once at boot: start right away when returning from an email link, else when the browser is idle. */
export function bootSync() {
  if (!syncConfig) return;
  const fromEmailLink = /access_token=|error_description=/.test(location.hash);
  const go = () => void loadSync();
  if (fromEmailLink) go();
  else if ("requestIdleCallback" in window) window.requestIdleCallback(go, { timeout: 3000 });
  else setTimeout(go, 1500);
}
