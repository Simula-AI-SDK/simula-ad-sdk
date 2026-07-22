import { LoadedCreative } from '../utils/api';

/**
 * Per-slot native ad cache — web port of the native `NativeAdCache`.
 *
 * - keyed `"adUnitId:position"` (LRU, 64 entries) — one serve/impression per
 *   slot across feed recycling
 * - process-wide impression-id dedup: a served creative is consumed ONCE,
 *   even if the same impression id lands in another slot
 * - no-fill markers live alongside, so a failed slot doesn't re-hit the
 *   network on every recycled row
 */

interface CacheEntry {
  creative: LoadedCreative;
  /** True once this entry's impression has fired (a recycled row re-renders but never re-impresses). */
  impressionFired: boolean;
}

const MAX_ENTRIES = 64;

const entries = new Map<string, CacheEntry>(); // Map preserves insertion order → LRU via re-insert
const noFillSlots = new Set<string>();
const servedImpressionIds = new Set<string>();

export function nativeAdCacheKey(adUnitId: string | undefined, position: number): string {
  return `${adUnitId ?? ''}:${position}`;
}

export function getCachedNativeAd(adUnitId: string | undefined, position: number): CacheEntry | null {
  const key = nativeAdCacheKey(adUnitId, position);
  const entry = entries.get(key);
  if (!entry) return null;
  // Refresh LRU position
  entries.delete(key);
  entries.set(key, entry);
  return entry;
}

export function cacheNativeAd(adUnitId: string | undefined, position: number, creative: LoadedCreative): void {
  const key = nativeAdCacheKey(adUnitId, position);
  entries.delete(key);
  entries.set(key, { creative, impressionFired: false });
  while (entries.size > MAX_ENTRIES) {
    const oldest = entries.keys().next().value;
    if (oldest === undefined) break;
    entries.delete(oldest);
  }
}

/** True when this impression id was already served anywhere in the process. */
export function isImpressionServed(impressionId: string): boolean {
  return servedImpressionIds.has(impressionId);
}

export function markImpressionServed(impressionId: string): void {
  if (impressionId) servedImpressionIds.add(impressionId);
}

export function markNativeImpressionFired(adUnitId: string | undefined, position: number): void {
  const entry = entries.get(nativeAdCacheKey(adUnitId, position));
  if (entry) entry.impressionFired = true;
}

export function hasNativeNoFill(adUnitId: string | undefined, position: number): boolean {
  return noFillSlots.has(nativeAdCacheKey(adUnitId, position));
}

export function markNativeNoFill(adUnitId: string | undefined, position: number): void {
  noFillSlots.add(nativeAdCacheKey(adUnitId, position));
}

export function invalidateNativeAd(adUnitId: string | undefined, position: number): void {
  entries.delete(nativeAdCacheKey(adUnitId, position));
  noFillSlots.delete(nativeAdCacheKey(adUnitId, position));
}

export function invalidateAllNativeAds(): void {
  entries.clear();
  noFillSlots.clear();
}

/** Test hook. Not public API. */
export function _resetNativeAdCacheForTests(): void {
  entries.clear();
  noFillSlots.clear();
  servedImpressionIds.clear();
}
