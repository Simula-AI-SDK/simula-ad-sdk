import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SimulaAds } from '../../core/SimulaAds';
import { SessionManager } from '../../core/session';
import { SimulaStorage } from '../../core/storage';
import { SimulaPrivacy } from '../../privacy/SimulaPrivacy';
import { Telemetry } from '../../telemetry/telemetry';
import { _resetPreloadCacheForTests, preloadedCount, consumePreloadedAd } from '../preloadCache';
import { _resetNativeAdCacheForTests, cacheNativeAd, getCachedNativeAd } from '../nativeAdCache';

const NATIVE_CREATIVE = {
  impression_id: 'imp-n1',
  ad_inserted: true,
  ad_format: 'character_ad',
  iframe_url: 'https://ads.test/native.html',
  bid_amt: 2.5,
};

function stubFetch() {
  const requests: { url: string; body: any }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: any, init?: any) => {
      const url = String(input);
      const body = init?.body ? JSON.parse(init.body as string) : undefined;
      requests.push({ url, body });
      if (url.includes('/session/create')) {
        return { ok: true, status: 200, json: async () => ({ sessionId: 'sess-1' }) } as any;
      }
      if (url.includes('/load/native')) {
        return { ok: true, status: 200, json: async () => NATIVE_CREATIVE } as any;
      }
      return { ok: true, status: 200, json: async () => ({}) } as any;
    }),
  );
  return requests;
}

describe('SimulaAds native-ad preload APIs (native parity)', () => {
  beforeEach(() => {
    SimulaAds._resetForTests();
    SessionManager._resetForTests();
    SimulaStorage._resetForTests();
    SimulaPrivacy._resetForTests();
    Telemetry._resetForTests();
    _resetPreloadCacheForTests();
    _resetNativeAdCacheForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns null when uninitialized', async () => {
    stubFetch();
    expect(await SimulaAds.preloadNativeAd({ adUnitId: 'feed' })).toBeNull();
  });

  it('preloads via POST /load/native and returns a consumable id', async () => {
    const requests = stubFetch();
    SimulaAds.initialize({ apiKey: 'key-1' });
    await new Promise((r) => setTimeout(r, 5));

    const id = await SimulaAds.preloadNativeAd({ adUnitId: 'feed', position: 2, theme: 'dark' });
    expect(id).toBeTruthy();
    expect(preloadedCount()).toBe(1);

    const loadReq = requests.find((r) => r.url.includes('/load/native'));
    expect(loadReq?.body).toMatchObject({ ad_unit_id: 'feed', position: 2, session_id: 'sess-1', theme: 'dark' });

    const consumed = consumePreloadedAd(id!);
    expect(consumed?.creative.impressionId).toBe('imp-n1');
    expect(consumed?.adUnitId).toBe('feed');
    expect(consumed?.position).toBe(2);
  });

  it('caps the preload cache at 5 (6th returns null)', async () => {
    stubFetch();
    SimulaAds.initialize({ apiKey: 'key-1' });
    await new Promise((r) => setTimeout(r, 5));

    const ids: (string | null)[] = [];
    for (let i = 0; i < 6; i++) {
      ids.push(await SimulaAds.preloadNativeAd({ adUnitId: 'feed', position: i }));
    }
    expect(ids.slice(0, 5).every(Boolean)).toBe(true);
    expect(ids[5]).toBeNull();
    expect(preloadedCount()).toBe(5);
  });

  it('destroyPreloadedAd removes the entry', async () => {
    stubFetch();
    SimulaAds.initialize({ apiKey: 'key-1' });
    await new Promise((r) => setTimeout(r, 5));

    const id = await SimulaAds.preloadNativeAd({ adUnitId: 'feed' });
    expect(preloadedCount()).toBe(1);
    SimulaAds.destroyPreloadedAd(id!);
    expect(preloadedCount()).toBe(0);
  });

  it('invalidateNativeAd(s) clear the slot cache', async () => {
    stubFetch();
    SimulaAds.initialize({ apiKey: 'key-1' });

    cacheNativeAd('feed', 0, { impressionId: 'imp-x', destination: 'web', bidAmt: 0, adBehavior: null });
    expect(getCachedNativeAd('feed', 0)).not.toBeNull();

    SimulaAds.invalidateNativeAd({ adUnitId: 'feed', position: 0 });
    expect(getCachedNativeAd('feed', 0)).toBeNull();

    cacheNativeAd('feed', 1, { impressionId: 'imp-y', destination: 'web', bidAmt: 0, adBehavior: null });
    SimulaAds.invalidateNativeAds();
    expect(getCachedNativeAd('feed', 1)).toBeNull();
  });
});
