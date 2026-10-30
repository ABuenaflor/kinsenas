import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { STORE_VERSION } from "@/store/migrations";
import { appDataSchema } from "@/store/schema";
import { safeStorage } from "@/store/storage";
import { DATA_KEYS, type AppData } from "@/store/types";
import { pickData, useStore } from "@/store/useStore";
import { applyRows, planPull, planPush, shadowAfterPush, toRecords, type Push, type RemoteRow, type Shadow } from "./records";
import { useSyncStatus } from "./status";

const TABLE = "kinsenas_records";
const META_KEY = "kinsenas:sync";
const PAGE = 1000;
const PUSH_BATCH = 500;
/** Re-read a little before the cursor so rows committed out of timestamp order aren't missed. */
const CURSOR_OVERLAP_MS = 10_000;
const EDIT_DEBOUNCE_MS = 1500;
const POLL_MS = 30_000;

interface Meta {
  userId: string;
  cursor: string | null;
  shadow: Shadow;
}

interface Row extends RemoteRow {
  schema_version: number;
  updated_at: string;
}

let client: SupabaseClient | null = null;
let userId: string | null = null;
let sessionKnown = false;
let running = false;
let again = false;
let applying = false;
let timer: ReturnType<typeof setTimeout> | undefined;
let detach: (() => void) | null = null;

const setStatus = useSyncStatus.setState;

function loadMeta(uid: string): Meta {
  try {
    const m = JSON.parse(safeStorage.getItem(META_KEY) as string) as Meta | null;
    if (m && m.userId === uid) return m;
  } catch {
    /* fall through to a fresh start */
  }
  return { userId: uid, cursor: null, shadow: {} };
}
const saveMeta = (m: Meta) => safeStorage.setItem(META_KEY, JSON.stringify(m));

export function start(config: { url: string; key: string }) {
  if (client) return;
  client = createClient(config.url, config.key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: "kinsenas:auth" },
  });
  client.auth.onAuthStateChange((_event, session) => {
    // Supabase warns against awaiting its own calls inside this callback.
    setTimeout(() => onSession(session), 0);
  });
}

function onSession(session: Session | null) {
  const uid = session?.user.id ?? null;
  if (sessionKnown && uid === userId) return;
  sessionKnown = true;
  userId = uid;
  detach?.();
  detach = null;
  if (!uid) {
    setStatus({ state: "signedOut", email: null, error: null });
    return;
  }
  setStatus({ state: "idle", email: session?.user.email ?? null, error: null });
  detach = attach();
  schedule(0);
}

function attach() {
  const unsub = useStore.subscribe((s, prev) => {
    if (!applying && DATA_KEYS.some((k) => s[k] !== prev[k])) schedule(EDIT_DEBOUNCE_MS);
  });
  const now = () => schedule(0);
  const onVisible = () => document.visibilityState === "visible" && now();
  window.addEventListener("focus", now);
  window.addEventListener("online", now);
  document.addEventListener("visibilitychange", onVisible);
  const poll = setInterval(() => document.visibilityState === "visible" && now(), POLL_MS);
  return () => {
    unsub();
    window.removeEventListener("focus", now);
    window.removeEventListener("online", now);
    document.removeEventListener("visibilitychange", onVisible);
    clearInterval(poll);
    clearTimeout(timer);
  };
}

function schedule(ms: number) {
  clearTimeout(timer);
  timer = setTimeout(() => void syncNow(), ms);
}

/** One pull-then-push cycle. Concurrent calls coalesce into one follow-up run. */
export async function syncNow() {
  if (running) {
    again = true;
    return;
  }
  const uid = userId;
  if (!client || !uid) return;
  if (!navigator.onLine) {
    setStatus({ state: "offline" });
    return;
  }
  running = true;
  setStatus({ state: "syncing", error: null });
  try {
    await cycle(client, uid);
    if (userId === uid) setStatus({ state: "idle", lastSyncedAt: Date.now(), error: null });
  } catch (e) {
    const offline = !navigator.onLine || (e instanceof TypeError && /fetch/i.test(e.message));
    setStatus(offline ? { state: "offline" } : { state: "error", error: e instanceof Error ? e.message : String(e) });
  } finally {
    running = false;
    if (again) {
      again = false;
      schedule(0);
    }
  }
}

async function cycle(db: SupabaseClient, uid: string) {
  const meta = loadMeta(uid);
  const rows = await pull(db, meta.cursor);
  const newer = rows.filter((r) => r.schema_version > STORE_VERSION);
  if (newer.length) throw new Error("Another device has a newer version of Kinsenas. Refresh this page to update.");

  // Pull: no awaits between reading and writing the store, so edits can't slip in between.
  const data = pickData(useStore.getState());
  const plan = planPull(toRecords(data), meta.shadow, rows);
  if (plan.apply.length) {
    const next = applyRows(data, plan.apply);
    const check = appDataSchema.safeParse(next);
    if (!check.success) throw new Error(`Couldn't use synced data (${check.error.issues[0]?.path.join(".") ?? "invalid"}).`);
    applying = true;
    try {
      useStore.setState(next as Partial<AppData>);
    } finally {
      applying = false;
    }
  }
  let shadow = plan.shadow;
  const cursor = rows.reduce<string | null>((max, r) => (max === null || r.updated_at > max ? r.updated_at : max), meta.cursor);
  saveMeta({ userId: uid, cursor, shadow });

  // Push whatever differs from what the server last confirmed.
  const pushes = planPush(toRecords(pickData(useStore.getState())), shadow);
  for (let i = 0; i < pushes.length; i += PUSH_BATCH) {
    const batch = pushes.slice(i, i + PUSH_BATCH);
    await push(db, uid, batch);
    shadow = shadowAfterPush(shadow, batch);
    saveMeta({ userId: uid, cursor, shadow });
  }
}

async function pull(db: SupabaseClient, cursor: string | null): Promise<Row[]> {
  const since = cursor ? new Date(Date.parse(cursor) - CURSOR_OVERLAP_MS).toISOString() : null;
  const out: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = db.from(TABLE).select("collection,id,data,deleted,schema_version,updated_at");
    if (since) q = q.gt("updated_at", since);
    const { data, error } = await q.order("updated_at").order("collection").order("id").range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...(data as Row[]));
    if (data.length < PAGE) return out;
  }
}

async function push(db: SupabaseClient, uid: string, batch: Push[]) {
  const rows = batch.map((p) => ({ user_id: uid, collection: p.collection, id: p.id, data: p.data, deleted: p.deleted, schema_version: STORE_VERSION }));
  const { error } = await db.from(TABLE).upsert(rows, { onConflict: "user_id,collection,id" });
  if (error) throw new Error(error.message);
}

/* ---------------- Account ---------------- */

const friendly = (msg: string) =>
  /invalid login credentials/i.test(msg) ? "Wrong email or password." : /email not confirmed/i.test(msg) ? "Confirm your email first — check your inbox." : msg;

export async function signIn(email: string, password: string): Promise<string | null> {
  if (!client) return "Sync isn't ready yet.";
  const { error } = await client.auth.signInWithPassword({ email, password });
  return error ? friendly(error.message) : null;
}

export async function signUp(email: string, password: string): Promise<{ error: string | null; needsConfirm: boolean }> {
  if (!client) return { error: "Sync isn't ready yet.", needsConfirm: false };
  const { data, error } = await client.auth.signUp({ email, password, options: { emailRedirectTo: location.origin } });
  if (error) return { error: friendly(error.message), needsConfirm: false };
  return { error: null, needsConfirm: !data.session };
}

/** Sign out; this browser keeps its data but forgets what it synced. */
export async function signOut() {
  if (!client) return;
  await client.auth.signOut({ scope: "local" });
  safeStorage.removeItem(META_KEY);
}
