import { LoadedCreative } from '../utils/api';

/**
 * Native ad preload cache — web port of the native `NativeAdPreloadCache`.
 * Holds at most 5 preloaded creatives, each consumed exactly once via
 * `consume` (a preloaded ad belongs to the first slot that claims it).
 */

export interface PreloadedNativeAd {
  preloadedAdId: string;
  creative: LoadedCreative;
  adUnitId?: string;
  position: number;
  theme?: string;
}

const MAX_PRELOADED = 5;

const preloaded = new Map<string, PreloadedNativeAd>();

export function preloadCapacityAvailable(): boolean {
  return preloaded.size < MAX_PRELOADED;
}

export function storePreloadedAd(entry: PreloadedNativeAd): void {
  if (preloaded.size >= MAX_PRELOADED) return;
  preloaded.set(entry.preloadedAdId, entry);
}

/** Returns the entry and removes it (single consumption), or null. */
export function consumePreloadedAd(preloadedAdId: string): PreloadedNativeAd | null {
  const entry = preloaded.get(preloadedAdId) ?? null;
  if (entry) preloaded.delete(preloadedAdId);
  return entry;
}

export function destroyPreloadedAd(preloadedAdId: string): void {
  preloaded.delete(preloadedAdId);
}

export function clearPreloadedAds(): void {
  preloaded.clear();
}

export function preloadedCount(): number {
  return preloaded.size;
}

/** Test hook. Not public API. */
export function _resetPreloadCacheForTests(): void {
  preloaded.clear();
}
