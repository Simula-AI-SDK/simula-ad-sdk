/**
 * SimulaStorage — consent-gated, crash-proof key-value persistence.
 *
 * Mirrors the native SDKs' durable stores (SharedPreferences / UserDefaults):
 * - localStorage when available and allowed, in-memory Map otherwise
 *   (Safari private mode throws on localStorage access — every call is guarded)
 * - consent gate: `setLocalStorageAllowed(false)` forces the in-memory store,
 *   so nothing persists beyond the page lifetime (Phase 1's ConsentSnapshot.
 *   allowsLocalStorage drives this — IAB TCF Purpose 1)
 * - never throws; a failed read resolves to null / a failed write is dropped
 */

const PREFIX = 'simula_ad_sdk_';

const memoryStore = new Map<string, string>();
let localStorageAllowed = true;
let availabilityCache: boolean | null = null;

function isLocalStorageAvailable(): boolean {
  if (availabilityCache !== null) return availabilityCache;
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      availabilityCache = false;
      return false;
    }
    const probe = `${PREFIX}probe`;
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    availabilityCache = true;
  } catch {
    availabilityCache = false;
  }
  return availabilityCache;
}

function usePersistent(): boolean {
  return localStorageAllowed && isLocalStorageAvailable();
}

function get(key: string): string | null {
  try {
    if (usePersistent()) {
      return window.localStorage.getItem(PREFIX + key);
    }
    const value = memoryStore.get(PREFIX + key);
    return value === undefined ? null : value;
  } catch {
    return null;
  }
}

function set(key: string, value: string): void {
  try {
    if (usePersistent()) {
      window.localStorage.setItem(PREFIX + key, value);
    } else {
      memoryStore.set(PREFIX + key, value);
    }
  } catch {
    // Dropped write — persistence is best-effort, never fatal
  }
}

function remove(key: string): void {
  try {
    if (usePersistent()) {
      window.localStorage.removeItem(PREFIX + key);
    } else {
      memoryStore.delete(PREFIX + key);
    }
  } catch {
    // Best-effort
  }
}

function getJSON<T>(key: string): T | null {
  const raw = get(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function setJSON(key: string, value: unknown): void {
  try {
    set(key, JSON.stringify(value));
  } catch {
    // Best-effort
  }
}

export const SimulaStorage = {
  /** Consent gate — false forces in-memory storage (nothing survives the page). */
  setLocalStorageAllowed(allowed: boolean): void {
    localStorageAllowed = allowed;
  },
  /** True when values survive page reloads (localStorage available AND consent allows). */
  isPersistent(): boolean {
    return usePersistent();
  },
  get,
  set,
  remove,
  getJSON,
  setJSON,
  /** Test hook — clears memory state and cached availability. Not public API. */
  _resetForTests(): void {
    memoryStore.clear();
    availabilityCache = null;
    localStorageAllowed = true;
  },
};
