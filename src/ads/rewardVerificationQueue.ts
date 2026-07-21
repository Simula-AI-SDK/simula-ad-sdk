import { SimulaStorage } from '../core/storage';
import { postVerifyReward } from '../utils/api';

/**
 * Durable, idempotent reward-verification queue — web port of the native
 * `RewardVerificationQueue` (SSV). A reward verification that couldn't land
 * (offline, 5xx, tab closed) is persisted and retried; it is NEVER lost.
 *
 * Semantics (native parity):
 * - **Idempotent**: HTTP 409 (already verified) is treated as SUCCESS
 * - **Backed off**: transient failures retry 5s → 60s (exponential)
 * - **4xx dropped** (except 409): permanent failures report failure once
 * - **Durable**: persisted via SimulaStorage, recovered on next page load
 * - Callbacks are in-memory only: a salvaged verification from a previous
 *   page still POSTs, but its callback is gone (same as native teardown
 *   salvage)
 */

export interface RewardVerification {
  serveId: string;
  sessionId: string;
  elapsedPlayTime: number;
  adUnitId: string;
  retryCount: number;
  lastAttemptTimestamp: number;
}

interface VerifyCallbacks {
  onVerified: (token?: string) => void;
  onFailed: (error: Error) => void;
}

const STORE_KEY = 'reward_verification_queue';
const MAX_QUEUE = 50;
const BASE_BACKOFF_MS = 5_000;
const MAX_BACKOFF_MS = 60_000;

let processing = false;
let scheduledTimer: ReturnType<typeof setTimeout> | null = null;
let listenersAttached = false;
const callbacks = new Map<string, VerifyCallbacks>();

function load(): RewardVerification[] {
  const raw = SimulaStorage.getJSON<RewardVerification[]>(STORE_KEY);
  return Array.isArray(raw) ? raw : [];
}

function save(queue: RewardVerification[]): void {
  SimulaStorage.setJSON(STORE_KEY, queue.slice(-MAX_QUEUE));
}

function backoffMs(retryCount: number): number {
  return Math.min(BASE_BACKOFF_MS * Math.pow(2, retryCount), MAX_BACKOFF_MS);
}

function dueAtOf(item: RewardVerification): number {
  return item.lastAttemptTimestamp + (item.retryCount > 0 ? backoffMs(item.retryCount - 1) : 0);
}

/** Reconnect / unload hooks — mirrors BeaconQueue (transient failures retry on `online`). */
function attachListeners(): void {
  if (listenersAttached || typeof window === 'undefined') return;
  listenersAttached = true;
  try {
    window.addEventListener('online', () => void processQueue());
    window.addEventListener('pagehide', () => void processQueue());
  } catch {
    // Best-effort
  }
}

/** After a pass, schedule the drain for the earliest due item — a backed-off
 * verification must retry WITHOUT waiting for a new enqueue or page reload. */
function scheduleNextDrain(remaining: RewardVerification[]): void {
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

async function processQueue(): Promise<void> {
  if (processing) return;
  processing = true;
  try {
    const now = Date.now();
    const snapshot = load();
    const snapshotIds = new Set(snapshot.map((v) => v.serveId));
    const remaining: RewardVerification[] = [];

    for (const item of snapshot) {
      const dueAt = item.lastAttemptTimestamp + (item.retryCount > 0 ? backoffMs(item.retryCount - 1) : 0);
      if (now < dueAt) {
        remaining.push(item);
        continue;
      }

      const result = await postVerifyReward({
        serveId: item.serveId,
        sessionId: item.sessionId,
        elapsedPlayTime: item.elapsedPlayTime,
        adUnitId: item.adUnitId,
      });
      const cb = callbacks.get(item.serveId);

      // 2xx or 409 (already verified — idempotent success)
      if ((result.status >= 200 && result.status < 300) || result.status === 409) {
        if (result.status === 409 || result.verified === true) {
          try {
            cb?.onVerified(result.token);
          } catch {
            // Host callback must never break the queue
          }
        } else {
          // 2xx with verified:false — the server rejected the play-through
          try {
            cb?.onFailed(new Error('Reward verification rejected by the server'));
          } catch {
            // ignore
          }
        }
        callbacks.delete(item.serveId);
        continue;
      }

      // Other 4xx — permanent, report failure and drop
      if (result.status >= 400 && result.status < 500) {
        try {
          cb?.onFailed(new Error(`Reward verification failed (HTTP ${result.status})`));
        } catch {
          // ignore
        }
        callbacks.delete(item.serveId);
        continue;
      }

      // 5xx / connectivity — retry with backoff
      remaining.push({ ...item, retryCount: item.retryCount + 1, lastAttemptTimestamp: now });
    }

    // Merge with anything enqueued WHILE the drain was awaiting — a reward
    // must NEVER be lost to a stale-snapshot overwrite.
    const fresh = load();
    const merged = [...remaining, ...fresh.filter((item) => !snapshotIds.has(item.serveId))];
    save(merged);
    scheduleNextDrain(merged);
  } finally {
    processing = false;
  }
}

export const RewardVerificationQueue = {
  /** Enqueue a verification and start draining. Never throws. */
  enqueue(
    params: { serveId: string; sessionId: string; elapsedPlayTime: number; adUnitId: string },
    cb: VerifyCallbacks,
  ): void {
    try {
      if (!params.serveId) return;
      attachListeners();
      const queue = load();
      if (!queue.some((v) => v.serveId === params.serveId)) {
        queue.push({ ...params, retryCount: 0, lastAttemptTimestamp: 0 });
        save(queue);
      }
      callbacks.set(params.serveId, cb);
      void processQueue();
    } catch {
      // Verification is best-effort — never fatal
    }
  },

  /** Drain persisted verifications (call at startup to recover). */
  triggerProcessQueue(): void {
    attachListeners();
    void processQueue();
  },

  size(): number {
    return load().length;
  },

  _resetForTests(): void {
    save([]);
    processing = false;
    callbacks.clear();
    listenersAttached = false;
    if (scheduledTimer !== null) {
      clearTimeout(scheduledTimer);
      scheduledTimer = null;
    }
  },
};
