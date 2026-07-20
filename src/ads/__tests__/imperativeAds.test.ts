import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SimulaAds } from '../../core/SimulaAds';
import { SessionManager } from '../../core/session';
import { SimulaStorage } from '../../core/storage';
import { SimulaPrivacy } from '../../privacy/SimulaPrivacy';
import { Telemetry } from '../../telemetry/telemetry';
import { SimulaInterstitialAd } from '../SimulaInterstitialAd';
import { SimulaRewardedAd } from '../SimulaRewardedAd';
import { SimulaAdEvent } from '../events';
import { _resetAdDedupForTests } from '../SimulaBaseAd';
import { RewardVerificationQueue } from '../rewardVerificationQueue';

const CREATIVE = {
  impression_id: 'imp-1',
  ad_inserted: true,
  iframe_url: 'https://ads.test/creative.html',
  bid_amt: 5,
  ad_behavior: { close: { delay_seconds: 0 } },
};

function stubFetch(loadHandler?: (url: string, body: any) => { status?: number; json?: any }) {
  const requests: { url: string; method: string; body: any }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: any, init?: any) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      const body = init?.body ? JSON.parse(init.body as string) : undefined;
      requests.push({ url, method, body });

      if (url.includes('/session/create')) {
        return { ok: true, status: 200, json: async () => ({ sessionId: 'sess-1' }) } as any;
      }
      if (url.includes('/load/interstitial') || url.includes('/load/rewarded') || url.includes('/load/native')) {
        const result = loadHandler?.(url, body) ?? { json: CREATIVE };
        const status = result.status ?? 200;
        return { ok: status >= 200 && status < 300, status, json: async () => result.json ?? CREATIVE } as any;
      }
      return { ok: true, status: 200, json: async () => ({}) } as any;
    }),
  );
  return requests;
}

function collectEvents(ad: { addAdEventsListener: (cb: (e: SimulaAdEvent) => void) => unknown }): SimulaAdEvent[] {
  const events: SimulaAdEvent[] = [];
  ad.addAdEventsListener((e) => events.push(e));
  return events;
}

describe('Imperative full-screen ads (native parity state machine)', () => {
  beforeEach(async () => {
    SimulaAds._resetForTests();
    SessionManager._resetForTests();
    SimulaStorage._resetForTests();
    SimulaPrivacy._resetForTests();
    Telemetry._resetForTests();
    RewardVerificationQueue._resetForTests();
    _resetAdDedupForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function init() {
    stubFetch();
    SimulaAds.initialize({ apiKey: 'key-1' });
    await new Promise((r) => setTimeout(r, 5)); // let the session warm land
  }

  it('load() before initialize → LOAD_FAILED not_initialized', async () => {
    stubFetch();
    const ad = new SimulaInterstitialAd('unit-1');
    const events = collectEvents(ad);
    ad.load();
    await new Promise((r) => setTimeout(r, 10));
    expect(events[0].type).toBe('LOAD_FAILED');
    expect(events[0].error?.code).toBe('not_initialized');
  });

  it('show() before load → DISPLAY_FAILED not_ready', async () => {
    await init();
    const ad = new SimulaInterstitialAd('unit-1');
    const events = collectEvents(ad);
    ad.show();
    expect(events[0].type).toBe('DISPLAY_FAILED');
    expect(events[0].error?.code).toBe('not_ready');
  });

  it('load() → LOADED, sending the native wire body', async () => {
    const requests = stubFetch();
    SimulaAds.initialize({ apiKey: 'key-1', adContext: { searchTerm: 'cooking' } });
    await new Promise((r) => setTimeout(r, 5));

    const ad = new SimulaInterstitialAd('unit-1');
    const events = collectEvents(ad);
    ad.load({ charId: 'char-1', charName: 'Luna', charDesc: 'guide' });
    await new Promise((r) => setTimeout(r, 10));

    expect(events.map((e) => e.type)).toEqual(['LOADED']);
    expect(ad.loaded).toBe(true);

    const loadReq = requests.find((r) => r.url.includes('/load/interstitial'));
    expect(loadReq?.body).toMatchObject({
      ad_unit_id: 'unit-1',
      session_id: 'sess-1',
      char_id: 'char-1',
      char_name: 'Luna',
      char_desc: 'guide',
    });
    expect(loadReq?.body.context).toMatchObject({ searchTerm: 'cooking', nsfw: false });
    expect(loadReq?.body.capabilities).toBeDefined();
  });

  it('no-fill → LOAD_FAILED no_fill', async () => {
    stubFetch(() => ({ json: { impression_id: null, ad_inserted: false } }));
    SimulaAds.initialize({ apiKey: 'key-1' });
    await new Promise((r) => setTimeout(r, 5));

    const ad = new SimulaInterstitialAd('unit-1');
    const events = collectEvents(ad);
    ad.load();
    await new Promise((r) => setTimeout(r, 10));

    expect(events[0].type).toBe('LOAD_FAILED');
    expect(events[0].error?.code).toBe('no_fill');
  });

  it('backend structured error → LOAD_FAILED ad_unit_not_found', async () => {
    stubFetch(() => ({ status: 404, json: { code: 'ad_unit_not_found', message: 'nope' } }));
    SimulaAds.initialize({ apiKey: 'key-1' });
    await new Promise((r) => setTimeout(r, 5));

    const ad = new SimulaInterstitialAd('unit-1');
    const events = collectEvents(ad);
    ad.load();
    await new Promise((r) => setTimeout(r, 10));

    expect(events[0].error?.code).toBe('ad_unit_not_found');
  });

  it('same-key re-load within 5 min → duplicate_request with retryInSeconds', async () => {
    stubFetch();
    SimulaAds.initialize({ apiKey: 'key-1' });
    await new Promise((r) => setTimeout(r, 5));

    const ad = new SimulaInterstitialAd('unit-1');
    const events = collectEvents(ad);
    ad.load();
    await new Promise((r) => setTimeout(r, 10));
    expect(events[0].type).toBe('LOADED');

    ad.load(); // same key — blocked by the dedup window
    await new Promise((r) => setTimeout(r, 10));

    const dup = events[1];
    expect(dup.type).toBe('LOAD_FAILED');
    expect(dup.error?.code).toBe('duplicate_request');
    expect(dup.error?.retryInSeconds).toBeGreaterThan(290);
    expect(dup.error?.retryInSeconds).toBeLessThanOrEqual(300);
  });

  it('stale loaded ad (1h+) → DISPLAY_FAILED stale', async () => {
    stubFetch();
    SimulaAds.initialize({ apiKey: 'key-1' });
    await new Promise((r) => setTimeout(r, 5));

    const ad = new SimulaInterstitialAd('unit-1');
    const events = collectEvents(ad);
    ad.load();
    await new Promise((r) => setTimeout(r, 10));
    expect(ad.loaded).toBe(true);

    // Advance the wall clock past the 1-hour staleness limit
    vi.useFakeTimers({ now: Date.now() + 61 * 60 * 1000, toFake: ['Date'] });
    ad.show();
    vi.useRealTimers();

    const displayFailed = events.find((e) => e.type === 'DISPLAY_FAILED');
    expect(displayFailed?.error?.code).toBe('stale');
    expect(ad.loaded).toBe(false);
  });

  it('show() without a document (SSR) → DISPLAY_FAILED no_presentation_context', async () => {
    stubFetch();
    SimulaAds.initialize({ apiKey: 'key-1' });
    await new Promise((r) => setTimeout(r, 5));

    const ad = new SimulaInterstitialAd('unit-1');
    const events = collectEvents(ad);
    ad.load();
    await new Promise((r) => setTimeout(r, 10));

    ad.show(); // node env: no document → presenter unavailable
    await new Promise((r) => setTimeout(r, 5));

    const displayFailed = events.find((e) => e.type === 'DISPLAY_FAILED');
    expect(displayFailed?.error?.code).toBe('no_presentation_context');
  });

  it('rewarded load hits /load/rewarded with the targeting body', async () => {
    const requests = stubFetch();
    SimulaAds.initialize({ apiKey: 'key-1' });
    await new Promise((r) => setTimeout(r, 5));

    const ad = new SimulaRewardedAd('unit-r');
    const events = collectEvents(ad);
    ad.load({ charName: 'Luna' });
    await new Promise((r) => setTimeout(r, 10));

    expect(events.map((e) => e.type)).toEqual(['LOADED']);
    const loadReq = requests.find((r) => r.url.includes('/load/rewarded'));
    expect(loadReq?.body).toMatchObject({ ad_unit_id: 'unit-r', session_id: 'sess-1', char_name: 'Luna' });
  });

  it('destroy() is idempotent and calls are safe no-ops afterwards', async () => {
    stubFetch();
    SimulaAds.initialize({ apiKey: 'key-1' });
    await new Promise((r) => setTimeout(r, 5));

    const ad = new SimulaInterstitialAd('unit-1');
    ad.destroy();
    ad.destroy();
    expect(() => {
      ad.load();
      ad.show();
    }).not.toThrow();
    expect(ad.loaded).toBe(false);
  });
});
