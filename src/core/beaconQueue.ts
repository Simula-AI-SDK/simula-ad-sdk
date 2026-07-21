import { SimulaStorage } from './storage';

/**
 * Durable beacon queue — web port of the native `AdBeaconQueue`. Today's
 * `track*` calls are fire-and-forget: a beacon that fails (offline, 5xx, tab
 * closed) is lost. This makes them durable: persisted via SimulaStorage,
 * retried with exponential backoff, recovered on the next page load.
 *
 * - **Deduped**: at most one entry per (url, body) pair
 * - **Backed off**: failed attempts retry 5s → 60s (exponential)
 * - **4xx dropped**: permanent failures are not retried
 * - **Unload-safe**: a flush is attempted with `keepalive` on pagehide
 * - Consent-gated by construction: it sits on SimulaStorage, which degrades
 *   to in-memory when the resolved ConsentSnapshot disallows local storage
 */

export interface PendingBeacon {
  url: string;
  method: 'GET' | 'POST' | 'PATCH';
  body?: string;
  /** When true, the request is signed with the current API key at send time. */
  auth?: boolean;
  retryCount: number;
  lastAttemptTimestamp: number;
}

const STORE_KEY = 'beacon_queue';
const MAX_QUEUE = 100;
const BASE_BACKOFF_MS = 5_000;
const MAX_BACKOFF_MS = 60_000;

let processing = false;
let scheduledTimer: ReturnType<typeof setTimeout> | null = null;
let onlineListenerAttached = false;

/**
 * Headers are built at SEND time (never persisted): a retried beacon carries
 * the CURRENT consent state and API key, and no Authorization value is ever
 * written to localStorage. Registered by SimulaAds.initialize.
 */
let headersProvider: (auth: boolean) => Record<string, string> = () => ({});

function load(): PendingBeacon[] {
  const raw = SimulaStorage.getJSON<PendingBeacon[]>(STORE_KEY);
  return Array.isArray(raw) ? raw : [];
}

function save(queue: PendingBeacon[]): void {
  SimulaStorage.setJSON(STORE_KEY, queue.slice(-MAX_QUEUE));
}

function backoffMs(retryCount: number): number {
  return Math.min(BASE_BACKOFF_MS * Math.pow(2, retryCount), MAX_BACKOFF_MS);
}

function dueAtOf(beacon: PendingBeacon): number {
  return beacon.lastAttemptTimestamp + (beacon.retryCount > 0 ? backoffMs(beacon.retryCount - 1) : 0);
}

/** After a pass, schedule the drain for the earliest due item — entries merged
 * mid-drain (or backed off) must deliver without waiting for a new enqueue. */
function scheduleNextDrain(remaining: PendingBeacon[]): void {
  if (scheduledTimer !== null) {
    clearTimeout(scheduledTimer);
    scheduledTimer = null;
  }
  if (remaining.length === 0) return;
  const now = Date.now();
  const nextDueAt = Math.min(...remaining.map(dueAtOf));
  const delay = Math.max(nextDueAt - now, 0);
  scheduledTimer = setTimeout(() => {
    scheduledTimer = null;
    void processQueue();
  }, delay);
}

async function sendOne(beacon: PendingBeacon): Promise<'ok' | 'retry' | 'drop'> {
  try {
    const response = await fetch(beacon.url, {
      method: beacon.method,
      headers: headersProvider(beacon.auth === true),
      body: beacon.body,
      keepalive: true,
    });
    if (response.ok) return 'ok';
    // Permanent failure (4xx) — drop rather than retry forever (native parity)
    if (response.status >= 400 && response.status < 500) return 'drop';
    return 'retry';
  } catch {
    return 'retry';
  }
}

function beaconIdentity(beacon: PendingBeacon): string {
  return `${beacon.method} ${beacon.url} ${beacon.body ?? ''}`;
}

async function processQueue(): Promise<void> {
  if (processing) return;
  processing = true;
  try {
    const now = Date.now();
    const snapshot = load();
    const snapshotIds = new Set(snapshot.map(beaconIdentity));
    const remaining: PendingBeacon[] = [];

    for (const beacon of snapshot) {
      const dueAt = beacon.lastAttemptTimestamp + (beacon.retryCount > 0 ? backoffMs(beacon.retryCount - 1) : 0);
      if (now < dueAt) {
        remaining.push(beacon);
        continue;
      }
      const result = await sendOne(beacon);
      if (result === 'retry') {
        remaining.push({ ...beacon, retryCount: beacon.retryCount + 1, lastAttemptTimestamp: now });
      }
      // 'ok' and 'drop' both leave the queue
    }

    // Merge with anything enqueued WHILE the drain was awaiting — never
    // clobber fresh entries with a stale snapshot (durability contract).
    const fresh = load();
    const merged = [...remaining, ...fresh.filter((item) => !snapshotIds.has(beaconIdentity(item)))];
    save(merged);
    scheduleNextDrain(merged);
  } finally {
    processing = false;
  }
}

function attachOnlineListener(): void {
  if (onlineListenerAttached || typeof window === 'undefined') return;
  onlineListenerAttached = true;
  try {
    window.addEventListener('online', () => void processQueue());
    window.addEventListener('pagehide', () => void processQueue());
  } catch {
    // Best-effort
  }
}

export const BeaconQueue = {
  /** Register the send-time headers builder (called by SimulaAds.initialize). */
  configure(opts: { headersProvider: (auth: boolean) => Record<string, string> }): void {
    headersProvider = opts.headersProvider;
  },

  /** Enqueue a beacon and start draining. Duplicates (same url+body) are ignored. Never throws. */
  enqueue(beacon: Omit<PendingBeacon, 'retryCount' | 'lastAttemptTimestamp'>): void {
    try {
      attachOnlineListener();
      const queue = load();
      if (queue.some((b) => b.url === beacon.url && b.body === beacon.body)) return;
      queue.push({ ...beacon, retryCount: 0, lastAttemptTimestamp: 0 });
      save(queue);
      void processQueue();
    } catch {
      // Beacons are best-effort — never fatal
    }
  },

  /** Drain any persisted beacons (call at startup to recover previous-page failures). */
  triggerProcessQueue(): void {
    attachOnlineListener();
    void processQueue();
  },

  /** Current queue length (tests/diagnostics). */
  size(): number {
    return load().length;
  },

  /** Test hook. Not public API. */
  _resetForTests(): void {
    save([]);
    processing = false;
    onlineListenerAttached = false;
    if (scheduledTimer !== null) {
      clearTimeout(scheduledTimer);
      scheduledTimer = null;
    }
  },
};
