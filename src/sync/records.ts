import type { Settings } from "@/domain/types";
import type { AppData } from "@/store/types";

/**
 * Cloud sync works on records: one per item in each collection, plus the
 * settings and rates singletons. Pure functions only; the engine does the I/O.
 */

export const COLLECTIONS = ["govDeductions", "customDeductions", "buckets", "rules", "categories", "cutoffs", "expenses", "toBuy", "remarks"] as const;
export const SINGLETONS = ["settings", "govRates"] as const;
type Collection = (typeof COLLECTIONS)[number];
type Singleton = (typeof SINGLETONS)[number];
export type RecordKind = Collection | Singleton;

const SINGLETON_ID = "main";

/** Per-device preferences that never leave this browser. */
export const DEVICE_SETTINGS = ["theme", "motion", "smoothScroll", "show3D"] as const satisfies readonly (keyof Settings)[];

export interface LocalRecord {
  collection: RecordKind;
  id: string;
  data: unknown;
  hash: string;
}

export interface RemoteRow {
  collection: string;
  id: string;
  data: unknown;
  deleted: boolean;
}

/** Last-synced hash per record key; tells "changed here" apart from "changed elsewhere". */
export type Shadow = Record<string, string>;

export const keyOf = (collection: string, id: string) => `${collection}:${id}`;

/** JSON with sorted object keys, so Postgres jsonb key reordering doesn't look like a change. */
export function stableStringify(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v) ?? "null";
  if (Array.isArray(v)) return `[${v.map((x) => (x === undefined ? "null" : stableStringify(x))).join(",")}]`;
  const obj = v as Record<string, unknown>;
  const parts = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`);
  return `{${parts.join(",")}}`;
}

/** cyrb53: a fast 53-bit string hash; plenty for change detection. */
export function hashString(str: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

const hashOf = (data: unknown) => hashString(stableStringify(data));

function sharedSettings(s: Settings): Partial<Settings> {
  const out: Partial<Settings> = { ...s };
  for (const k of DEVICE_SETTINGS) delete out[k];
  return out;
}

export function toRecords(data: AppData): Map<string, LocalRecord> {
  const out = new Map<string, LocalRecord>();
  const add = (collection: RecordKind, id: string, value: unknown) => out.set(keyOf(collection, id), { collection, id, data: value, hash: hashOf(value) });
  add("settings", SINGLETON_ID, sharedSettings(data.settings));
  add("govRates", SINGLETON_ID, data.govRates);
  for (const c of COLLECTIONS) for (const item of data[c]) add(c, item.id, item);
  return out;
}

const isCollection = (c: string): c is Collection => (COLLECTIONS as readonly string[]).includes(c);
const isKnown = (c: string): c is RecordKind => isCollection(c) || (SINGLETONS as readonly string[]).includes(c);

/** Apply remote rows to local data (upsert in place, append new, drop deleted). Returns new data; input untouched. */
export function applyRows(data: AppData, rows: RemoteRow[]): AppData {
  const next = { ...data } as AppData;
  const byCollection = new Map<Collection, RemoteRow[]>();
  for (const r of rows) {
    if (r.collection === "settings" && r.id === SINGLETON_ID && !r.deleted) {
      const keep: Partial<Settings> = {};
      for (const k of DEVICE_SETTINGS) Object.assign(keep, { [k]: data.settings[k] });
      next.settings = { ...data.settings, ...(r.data as Partial<Settings>), ...keep };
    } else if (r.collection === "govRates" && r.id === SINGLETON_ID && !r.deleted) {
      next.govRates = r.data as AppData["govRates"];
    } else if (isCollection(r.collection)) {
      const list = byCollection.get(r.collection) ?? [];
      list.push(r);
      byCollection.set(r.collection, list);
    }
  }
  for (const [c, list] of byCollection) {
    const items = new Map((data[c] as { id: string }[]).map((x) => [x.id, x]));
    for (const r of list) {
      if (r.deleted) items.delete(r.id);
      else items.set(r.id, r.data as { id: string });
    }
    (next as unknown as Record<Collection, unknown[]>)[c] = [...items.values()];
  }
  return next;
}

export interface Push {
  collection: RecordKind;
  id: string;
  data: unknown;
  deleted: boolean;
  hash: string;
}

export interface SyncPlan {
  /** Remote rows to apply locally. */
  apply: RemoteRow[];
  /** Shadow after applying `apply` (before pushing). */
  shadow: Shadow;
}

/**
 * Decide which pulled rows to take. A record edited here since the last sync
 * keeps the local version (it's pushed next). A record we've never synced
 * takes the remote version, so a fresh device adopts the account's settings
 * instead of overwriting them with its defaults.
 */
export function planPull(local: Map<string, LocalRecord>, shadow: Shadow, remote: RemoteRow[]): SyncPlan {
  const next: Shadow = { ...shadow };
  const apply: RemoteRow[] = [];
  for (const r of remote) {
    if (!isKnown(r.collection)) continue;
    const k = keyOf(r.collection, r.id);
    const mine = local.get(k);
    const known = shadow[k];
    const dirtyHere = known !== undefined && mine?.hash !== known;
    const remoteHash = r.deleted ? undefined : hashOf(r.data);
    if (dirtyHere) {
      if (mine === undefined && remoteHash === undefined) delete next[k]; // deleted on both sides
      else if (mine === undefined && remoteHash !== undefined && remoteHash !== known) {
        apply.push(r); // edited elsewhere beats deleted here
        next[k] = remoteHash;
      }
      continue;
    }
    if (remoteHash === undefined) {
      if (mine) apply.push(r);
      delete next[k];
    } else {
      if (mine?.hash !== remoteHash) apply.push(r);
      next[k] = remoteHash;
    }
  }
  return { apply, shadow: next };
}

/** Everything that differs from the shadow: new/changed records, and tombstones for removed ones. */
export function planPush(local: Map<string, LocalRecord>, shadow: Shadow): Push[] {
  const out: Push[] = [];
  for (const [k, r] of local) if (shadow[k] !== r.hash) out.push({ collection: r.collection, id: r.id, data: r.data, deleted: false, hash: r.hash });
  for (const k of Object.keys(shadow)) {
    if (local.has(k)) continue;
    const i = k.indexOf(":");
    const collection = k.slice(0, i);
    if (isKnown(collection)) out.push({ collection, id: k.slice(i + 1), data: null, deleted: true, hash: "" });
  }
  return out;
}

export function shadowAfterPush(shadow: Shadow, pushed: Push[]): Shadow {
  const next = { ...shadow };
  for (const p of pushed) {
    const k = keyOf(p.collection, p.id);
    if (p.deleted) delete next[k];
    else next[k] = p.hash;
  }
  return next;
}
