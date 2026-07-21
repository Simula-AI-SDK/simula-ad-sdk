// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SimulaAds } from '../../core/SimulaAds';
import { SessionManager } from '../../core/session';
import { SimulaStorage } from '../../core/storage';
import { SimulaPrivacy } from '../../privacy/SimulaPrivacy';
import { Telemetry } from '../../telemetry/telemetry';
import { SimulaInterstitialAd } from '../SimulaInterstitialAd';
import { SimulaAdEvent } from '../events';
import { _resetFullscreenForTests, isFullscreenActive } from '../fullscreenPresenter';
import { RewardVerificationQueue } from '../rewardVerificationQueue';

const CREATIVE = {
  impression_id: 'imp-1',
  ad_inserted: true,
  rendered_html: '<html><body>ad</body></html>',
  bid_amt: 5,
  ad_behavior: { close: { delay_seconds: 0 } },
};

function stubFetch(loadBody: any = CREATIVE) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: any, init?: any) => {
      const url = String(input);
      if (url.includes('/session/create')) {
        return { ok: true, status: 200, json: async () => ({ sessionId: 'sess-1' }) } as any;
      }
      if (url.includes('/load/interstitial')) {
        return { ok: true, status: 200, json: async () => loadBody } as any;
      }
      return { ok: true, status: 200, json: async () => ({}) } as any;
    }),
  );
}

describe('fullscreen lifecycle fixes (PR #12 threads #15/#16/#18/#19)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.documentElement.style.overflow = '';
    SimulaAds._resetForTests();
    SessionManager._resetForTests();
    SimulaStorage._resetForTests();
    SimulaPrivacy._resetForTests();
    Telemetry._resetForTests();
    RewardVerificationQueue._resetForTests();
    _resetFullscreenForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
    document.documentElement.style.overflow = '';
  });

  async function init() {
    stubFetch();
    SimulaAds.initialize({ apiKey: 'key-1' });
    await new Promise((r) => setTimeout(r, 5));
  }

  async function loadAndShow(ad: SimulaInterstitialAd, events: SimulaAdEvent[]) {
    ad.load();
    await new Promise((r) => setTimeout(r, 10));
    ad.show();
    await new Promise((r) => setTimeout(r, 5));
  }

  it('#15: destroy() while showing still delivers CLOSED', async () => {
    await init();
    const ad = new SimulaInterstitialAd('unit-1');
    const events: SimulaAdEvent[] = [];
    ad.addAdEventsListener((e) => events.push(e));
    await loadAndShow(ad, events);
    expect(isFullscreenActive()).toBe(true);

    ad.destroy();
    expect(events.map((e) => e.type)).toContain('CLOSED');
    expect(isFullscreenActive()).toBe(false);
  });

  it('#16: destroy() mid-load never emits LOADED and releases the dedup slot', async () => {
    // Deferred creative fetch — we control when it resolves
    let resolveLoad: ((v: any) => void) | null = null;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: any) => {
        const url = String(input);
        if (url.includes('/session/create')) {
          return { ok: true, status: 200, json: async () => ({ sessionId: 'sess-1' }) } as any;
        }
        if (url.includes('/load/interstitial')) {
          return new Promise((resolve) => {
            resolveLoad = resolve;
          });
        }
        return { ok: true, status: 200, json: async () => ({}) } as any;
      }),
    );
    SimulaAds.initialize({ apiKey: 'key-1' });
    await new Promise((r) => setTimeout(r, 5));

    const ad = new SimulaInterstitialAd('unit-1');
    const events: SimulaAdEvent[] = [];
    ad.addAdEventsListener((e) => events.push(e));
    ad.load();
    await new Promise((r) => setTimeout(r, 5));

    ad.destroy();
    resolveLoad!({ ok: true, status: 200, json: async () => CREATIVE });
    await new Promise((r) => setTimeout(r, 10));

    expect(events).toHaveLength(0); // silent after destroy
    expect(ad.loaded).toBe(false);

    // The dedup slot was released — a fresh instance with the same key loads fine
    const ad2 = new SimulaInterstitialAd('unit-1');
    const events2: SimulaAdEvent[] = [];
    ad2.addAdEventsListener((e) => events2.push(e));
    ad2.load();
    await new Promise((r) => setTimeout(r, 10));
    resolveLoad!({ ok: true, status: 200, json: async () => CREATIVE });
    await new Promise((r) => setTimeout(r, 10));
    expect(events2.map((e) => e.type)).toContain('LOADED');
  });

  it('#18/#19: showPreview properly closes the showing ad and releases the mutex', async () => {
    await init();
    const ad = new SimulaInterstitialAd('unit-1');
    const events: SimulaAdEvent[] = [];
    ad.addAdEventsListener((e) => events.push(e));
    await loadAndShow(ad, events);
    expect(isFullscreenActive()).toBe(true);
    expect(document.documentElement.style.overflow).toBe('hidden');

    // Preview takes over: the showing ad is properly CLOSED (not orphaned)
    const preview = ad.showPreview({ closeTreatment: 'hidden', delaySeconds: 0 });
    expect(events.map((e) => e.type)).toContain('CLOSED');
    expect(isFullscreenActive()).toBe(true); // preview holds the mutex

    preview?.close();
    expect(isFullscreenActive()).toBe(false);
    // The takeover path must NOT leak the scroll lock (host's true value restored)
    expect(document.documentElement.style.overflow).toBe('');

    // A new ad (different unit → outside the dedup window) can show immediately
    const ad2 = new SimulaInterstitialAd('unit-2');
    const events2: SimulaAdEvent[] = [];
    ad2.addAdEventsListener((e) => events2.push(e));
    ad2.load();
    await new Promise((r) => setTimeout(r, 10));
    ad2.show();
    await new Promise((r) => setTimeout(r, 5));
    expect(events2.map((e) => e.type)).toContain('DISPLAYED');
    expect(events2.some((e) => e.error?.code === 'already_showing')).toBe(false);
  });

  it('#19: two back-to-back shows keep one-at-a-time with proper CLOSED on the first', async () => {
    await init();
    const ad1 = new SimulaInterstitialAd('unit-1');
    const events1: SimulaAdEvent[] = [];
    ad1.addAdEventsListener((e) => events1.push(e));
    await loadAndShow(ad1, events1);

    const ad2 = new SimulaInterstitialAd('unit-2');
    const events2: SimulaAdEvent[] = [];
    ad2.addAdEventsListener((e) => events2.push(e));
    ad2.load();
    await new Promise((r) => setTimeout(r, 10));
    // Second show() while first is active → already_showing (mutex respected)
    ad2.show();
    expect(events2.some((e) => e.type === 'DISPLAY_FAILED' && e.error?.code === 'already_showing')).toBe(true);
    expect(events1.map((e) => e.type)).not.toContain('CLOSED');
  });

  it('#8: load() while showing is a silent no-op (Kotlin parity)', async () => {
    await init();
    const ad = new SimulaInterstitialAd('unit-1');
    const events: SimulaAdEvent[] = [];
    ad.addAdEventsListener((e) => events.push(e));
    await loadAndShow(ad, events);
    expect(isFullscreenActive()).toBe(true);

    const before = events.length;
    ad.load(); // ignored — an ad is on screen
    await new Promise((r) => setTimeout(r, 10));
    expect(events.length).toBe(before); // no LOAD_FAILED, no LOADED, nothing
  });
});
