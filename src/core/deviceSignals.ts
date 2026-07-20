/**
 * Device-context signals attached as `X-*` headers to every first-party
 * Simula API + telemetry request (merged at the api.ts header chokepoint).
 * Web port of the native `SimulaDeviceSignals`.
 *
 * Browsers expose only a subset of the native signals:
 * - `X-Timezone`      — IANA time-zone id (always available)
 * - `X-Storage-Free`  — available bytes (navigator.storage.estimate, Chromium)
 * - `X-Battery-Level` — 0–100 (navigator.getBattery, Chromium)
 * - `X-Battery-State` — `charging` | `full` | `unplugged` | `unknown`
 *
 * (`X-Memory-Free` / `X-Volume` / `X-Ringer-Mode` have no web API — omitted,
 * matching the native "omit on failure, never send misleading zeros" rule.)
 *
 * Performance: the request path only ever reads the pre-built cached snapshot
 * — no async calls, never blocks. The snapshot is computed at prime and
 * refreshed lazily on a short TTL with a single-flight guard.
 */

const TTL_MS = 10_000;

let snapshot: Record<string, string> = {};
let computedAtMs = 0;
let refreshing = false;

function buildSnapshot(
  timezone?: string,
  storageFreeBytes?: number,
  batteryLevel?: number,
  batteryCharging?: boolean,
): Record<string, string> {
  const h: Record<string, string> = {};
  if (timezone) h['X-Timezone'] = timezone;
  if (storageFreeBytes !== undefined && storageFreeBytes >= 0) h['X-Storage-Free'] = String(Math.floor(storageFreeBytes));
  if (batteryLevel !== undefined && batteryLevel >= 0 && batteryLevel <= 1) {
    h['X-Battery-Level'] = String(Math.round(batteryLevel * 100));
  }
  if (batteryCharging !== undefined) {
    h['X-Battery-State'] = batteryCharging ? 'charging' : 'unplugged';
  }
  return h;
}

async function computeSnapshot(): Promise<Record<string, string>> {
  let timezone: string | undefined;
  let storageFreeBytes: number | undefined;
  let batteryLevel: number | undefined;
  let batteryCharging: boolean | undefined;

  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    timezone = undefined;
  }

  try {
    const storageApi = typeof navigator !== 'undefined' ? (navigator as any).storage : undefined;
    if (storageApi && typeof storageApi.estimate === 'function') {
      const estimate = await storageApi.estimate();
      if (estimate && typeof estimate.quota === 'number') {
        storageFreeBytes = Math.max(0, estimate.quota - (typeof estimate.usage === 'number' ? estimate.usage : 0));
      }
    }
  } catch {
    storageFreeBytes = undefined;
  }

  try {
    const getBattery = typeof navigator !== 'undefined' ? (navigator as any).getBattery : undefined;
    if (typeof getBattery === 'function') {
      const battery = await getBattery.call(navigator);
      if (battery) {
        if (typeof battery.level === 'number') batteryLevel = battery.level;
        if (typeof battery.charging === 'boolean') batteryCharging = battery.charging;
      }
    }
  } catch {
    batteryLevel = undefined;
    batteryCharging = undefined;
  }

  return buildSnapshot(timezone, storageFreeBytes, batteryLevel, batteryCharging);
}

function launchRefresh(): void {
  if (refreshing) return;
  refreshing = true;
  computeSnapshot()
    .then((next) => {
      snapshot = next;
      computedAtMs = Date.now();
    })
    .catch(() => {
      // Keep serving the previous snapshot on failure
    })
    .finally(() => {
      refreshing = false;
    });
}

/** Idempotent. Computes the first snapshot off the critical path. */
export function primeDeviceSignals(): void {
  launchRefresh();
}

/**
 * The current signals as request headers. O(1) read of the cached snapshot;
 * if stale, a single background refresh is kicked off (never blocking) so the
 * NEXT request picks up fresher values.
 */
export function deviceSignalHeaders(): Record<string, string> {
  if (Date.now() - computedAtMs > TTL_MS) {
    launchRefresh();
  }
  return snapshot;
}

/** Test hook. Not public API. */
export function _resetDeviceSignalsForTests(): void {
  snapshot = {};
  computedAtMs = 0;
  refreshing = false;
}
