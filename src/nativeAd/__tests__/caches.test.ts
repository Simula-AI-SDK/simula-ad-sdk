import { describe, it, expect, beforeEach } from 'vitest';
import {
  cacheNativeAd,
  getCachedNativeAd,
  hasNativeNoFill,
  markNativeNoFill,
  isImpressionServed,
  markImpressionServed,
  markNativeImpressionFired,
  invalidateNativeAd,
  invalidateAllNativeAds,
  _resetNativeAdCacheForTests,
} from '../nativeAdCache';
import {
  storePreloadedAd,
  consumePreloadedAd,
  destroyPreloadedAd,
  preloadCapacityAvailable,
  preloadedCount,
  _resetPreloadCacheForTests,
} from '../preloadCache';
import { LoadedCreative } from '../../utils/api';

const creative = (id: string): LoadedCreative => ({
  impressionId: id,
  iframeUrl: 'https://ads.test/c.html',
  destination: 'web',
  bidAmt: 1,
  adBehavior: null,
});

describe('NativeAdCache (native parity: LRU-64 + impression dedup)', () => {
  beforeEach(() => {
    _resetNativeAdCacheForTests();
  });

  it('round-trips per (adUnitId, position)', () => {
    cacheNativeAd('feed', 0, creative('imp-1'));
    expect(getCachedNativeAd('feed', 0)?.creative.impressionId).toBe('imp-1');
    expect(getCachedNativeAd('feed', 1)).toBeNull();
    expect(getCachedNativeAd('explore', 0)).toBeNull();
  });

  it('evicts the least-recently-used entry beyond 64', () => {
    for (let i = 0; i < 70; i++) cacheNativeAd('feed', i, creative(`imp-${i}`));
    expect(getCachedNativeAd('feed', 0)).toBeNull(); // evicted
    expect(getCachedNativeAd('feed', 69)).not.toBeNull();
  });

  it('impression ids are served process-wide exactly once', () => {
    expect(isImpressionServed('imp-1')).toBe(false);
    markImpressionServed('imp-1');
    expect(isImpressionServed('imp-1')).toBe(true);
  });

  it('tracks per-slot impression-fired state', () => {
    cacheNativeAd('feed', 0, creative('imp-1'));
    expect(getCachedNativeAd('feed', 0)?.impressionFired).toBe(false);
    markNativeImpressionFired('feed', 0);
    expect(getCachedNativeAd('feed', 0)?.impressionFired).toBe(true);
  });

  it('no-fill markers round-trip and invalidate', () => {
    expect(hasNativeNoFill('feed', 0)).toBe(false);
    markNativeNoFill('feed', 0);
    expect(hasNativeNoFill('feed', 0)).toBe(true);
    invalidateNativeAd('feed', 0);
    expect(hasNativeNoFill('feed', 0)).toBe(false);
  });

  it('invalidateNativeAds clears everything', () => {
    cacheNativeAd('feed', 0, creative('imp-1'));
    markNativeNoFill('feed', 1);
    invalidateAllNativeAds();
    expect(getCachedNativeAd('feed', 0)).toBeNull();
    expect(hasNativeNoFill('feed', 1)).toBe(false);
  });
});

describe('NativeAdPreloadCache (native parity: cap 5, single consumption)', () => {
  beforeEach(() => {
    _resetPreloadCacheForTests();
  });

  it('consumes exactly once', () => {
    storePreloadedAd({ preloadedAdId: 'p1', creative: creative('imp-1'), position: 0 });
    expect(consumePreloadedAd('p1')?.creative.impressionId).toBe('imp-1');
    expect(consumePreloadedAd('p1')).toBeNull();
  });

  it('caps at 5 preloaded ads', () => {
    for (let i = 0; i < 6; i++) {
      expect(preloadCapacityAvailable()).toBe(i < 5);
      storePreloadedAd({ preloadedAdId: `p${i}`, creative: creative(`imp-${i}`), position: i });
    }
    expect(preloadedCount()).toBe(5);
    expect(preloadCapacityAvailable()).toBe(false);
  });

  it('destroy removes without consumption', () => {
    storePreloadedAd({ preloadedAdId: 'p1', creative: creative('imp-1'), position: 0 });
    destroyPreloadedAd('p1');
    expect(preloadedCount()).toBe(0);
  });
});
