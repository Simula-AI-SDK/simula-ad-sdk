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
  headers?: Record<string, string>;
  retryCount: number;
  lastAttemptTimestamp: number;
}

const STORE_KEY = 'beacon_queue';
const MAX_QUEUE = 100;
const BASE_BACKOFF_MS = 5_000;
const MAX_BACKOFF_MS = 60_000;

let processing = false;
let onlineListenerAttached = false;

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

async function sendOne(beacon: PendingBeacon): Promise<'ok' | 'retry' | 'drop'> {
  try {
    const response = await fetch(beacon.url, {
      method: beacon.method,
      headers: beacon.headers,
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

async function processQueue(): Promise<void> {
  if (processing) return;
  processing = true;
  try {
    const now = Date.now();
    const queue = load();
    const remaining: PendingBeacon[] = [];

    for (const beacon of queue) {
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

    save(remaining);
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
  },
};
