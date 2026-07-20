/**
 * Image preloader with in-flight dedup — the SDK's single image-warming
 * pipeline (mirrors the native ImageCache's in-flight coalescing).
 *
 * - the same URL is never fetched twice concurrently (one shared promise)
 * - successfully warmed URLs short-circuit future calls (browser HTTP cache
 *   does the real caching; this avoids re-creating Image objects per row)
 * - failures are NOT cached (a transient error stays retryable) and never
 *   reject — image warming is best-effort, never fatal
 */

const inflight = new Map<string, Promise<void>>();
const completed = new Set<string>();

export function preloadImage(url: string): Promise<void> {
  if (!url) return Promise.resolve();
  if (completed.has(url)) return Promise.resolve();
  const existing = inflight.get(url);
  if (existing) return existing;

  const promise = new Promise<void>((resolve) => {
    try {
      const img = new Image();
      img.onload = () => {
        inflight.delete(url);
        completed.add(url);
        resolve();
      };
      img.onerror = () => {
        inflight.delete(url); // failure stays retryable next time
        resolve();
      };
      img.src = url;
    } catch {
      inflight.delete(url);
      resolve();
    }
  });
  inflight.set(url, promise);
  return promise;
}

export function preloadImages(urls: string[]): Promise<void[]> {
  return Promise.all(urls.map(preloadImage));
}

/** Test hook. Not public API. */
export function _resetImagePreloaderForTests(): void {
  inflight.clear();
  completed.clear();
}
