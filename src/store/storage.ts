import type { StateStorage } from "zustand/middleware";

/** localStorage when usable; otherwise an in-memory map (private mode, blocked storage…). */
function probe(): Storage | null {
  try {
    const ls = globalThis.localStorage;
    const k = "__kinsenas_probe__";
    ls.setItem(k, "1");
    ls.removeItem(k);
    return ls;
  } catch {
    return null;
  }
}

const ls = probe();
const memory = new Map<string, string>();

export const storageAvailable = ls !== null;

export const safeStorage: StateStorage = {
  getItem: (name) => {
    try {
      return ls ? ls.getItem(name) : (memory.get(name) ?? null);
    } catch {
      return memory.get(name) ?? null;
    }
  },
  setItem: (name, value) => {
    try {
      if (ls) ls.setItem(name, value);
      else memory.set(name, value);
    } catch {
      memory.set(name, value);
    }
  },
  removeItem: (name) => {
    try {
      ls?.removeItem(name);
    } catch {
      /* ignore */
    }
    memory.delete(name);
  },
};
