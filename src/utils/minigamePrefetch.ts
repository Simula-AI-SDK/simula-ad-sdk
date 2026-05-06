import { InitMinigameRequest, MinigameResponse } from '../types';
import { getMinigame } from './api';

const PREFETCH_TTL_MS = 60_000;

interface CacheEntry {
  promise: Promise<MinigameResponse>;
  inserted: number;
}

const cache: Map<string, CacheEntry> = new Map();

const isFresh = (entry: CacheEntry): boolean =>
  Date.now() - entry.inserted < PREFETCH_TTL_MS;

export const prefetchMinigame = (params: InitMinigameRequest): void => {
  const key = params.gameType;
  const existing = cache.get(key);
  if (existing && isFresh(existing)) return;

  const promise = getMinigame(params).catch((err) => {
    // Drop failed prefetches so the click-time fetch can retry cleanly.
    if (cache.get(key)?.promise === promise) {
      cache.delete(key);
    }
    throw err;
  });
  cache.set(key, { promise, inserted: Date.now() });
};

export const consumeMinigame = (
  gameType: string,
): Promise<MinigameResponse> | null => {
  const entry = cache.get(gameType);
  if (!entry) return null;
  cache.delete(gameType);
  if (!isFresh(entry)) return null;
  return entry.promise;
};

export const clearMinigamePrefetchCache = (): void => {
  cache.clear();
};
