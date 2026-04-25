import type {
  SimulaAdEventSubscription,
  SimulaEventHandler,
  SimulaEventType,
} from './types';

/**
 * Per-instance listener registry for imperative managers.
 *
 * - `addAdEventListener(type, handler)` returns `{ remove }` for unsubscribe.
 * - `emit(type, payload)` iterates handlers with per-handler try/catch so a
 *   single bad listener cannot break the event pipeline.
 * - `setDisposed()` short-circuits subsequent emissions after `.dispose()`.
 */
export class EventRegistry {
  private listeners: Map<SimulaEventType, Set<SimulaEventHandler>> = new Map();
  private disposed: boolean = false;

  addAdEventListener(
    type: SimulaEventType,
    handler: SimulaEventHandler,
  ): SimulaAdEventSubscription {
    let bucket = this.listeners.get(type);
    if (!bucket) {
      bucket = new Set();
      this.listeners.set(type, bucket);
    }
    bucket.add(handler);
    return {
      remove: () => {
        const current = this.listeners.get(type);
        if (current) {
          current.delete(handler);
          if (current.size === 0) {
            this.listeners.delete(type);
          }
        }
      },
    };
  }

  emit(type: SimulaEventType, payload: unknown): void {
    if (this.disposed) return;
    const bucket = this.listeners.get(type);
    if (!bucket || bucket.size === 0) return;
    // Copy to protect against listeners that mutate the set mid-iteration.
    const handlers = Array.from(bucket);
    for (const handler of handlers) {
      try {
        handler(payload);
      } catch (err) {
        // Isolate bad listeners; never let one break the pipeline.
        // eslint-disable-next-line no-console
        console.error('[Simula] Ad event listener threw:', err);
      }
    }
  }

  setDisposed(): void {
    this.disposed = true;
    this.listeners.clear();
  }

  isDisposed(): boolean {
    return this.disposed;
  }
}
