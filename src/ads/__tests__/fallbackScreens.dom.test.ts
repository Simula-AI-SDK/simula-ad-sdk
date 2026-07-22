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
  rendered_html: '<html><body>primary</body></html>',
  bid_amt: 5,
  ad_behavior: { close: { delay_seconds: 0 } },
};

const FALLBACKS = {
  impression_id: 'imp-1',
  ads: [
    { ad_id: 'fb-1', html: '<html><body>end screen 1</body></html>' },
    { ad_id: 'fb-2', html: '<html><body>end screen 2</body></html>' },
  ],
};

function stubFetch(fallbacksBody: any = FALLBACKS) {
  const urls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: any) => {
      const url = String(input);
      urls.push(url);
      if (url.includes('/session/create')) {
        return { ok: true, status: 200, json: async () => ({ sessionId: 'sess-1' }) } as any;
      }
      if (url.includes('/load/interstitial')) {
        return { ok: true, status: 200, json: async () => CREATIVE } as any;
      }
      if (url.includes('/load/fallbacks/imp-1')) {
        return { ok: true, status: 200, json: async () => fallbacksBody } as any;
      }
      return { ok: true, status: 200, json: async () => ({}) } as any;
    }),
  );
  return urls;
}

function overlayCount(): number {
  return document.querySelectorAll('[data-simula-fullscreen-ad]').length;
}

function currentOverlayHtml(): string {
  const iframe = document.querySelector('[data-simula-fullscreen-ad] iframe') as HTMLIFrameElement | null;
  return iframe?.getAttribute('srcdoc') ?? '';
}

function closeCurrentOverlay() {
  (document.querySelector('button[aria-label="Close ad"]') as HTMLButtonElement)?.click();
}

describe('post-close fallback screens (Kotlin/Swift parity)', () => {
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
    vi.useRealTimers();
    document.body.innerHTML = '';
    document.documentElement.style.overflow = '';
  });

  async function init() {
    SimulaAds.initialize({ apiKey: 'key-1' });
    await new Promise((r) => setTimeout(r, 5));
  }

  it('presents fallback screens in reveal order after the primary close; CLOSED only after the last', async () => {
    const urls = stubFetch();
    await init();

    const ad = new SimulaInterstitialAd('unit-1');
    const events: SimulaAdEvent[] = [];
    ad.addAdEventsListener((e) => events.push(e));
    ad.load();
    await new Promise((r) => setTimeout(r, 10));
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'setInterval'] });
    ad.show();
    await vi.advanceTimersByTimeAsync(5);
    expect(overlayCount()).toBe(1);

    // Close the primary → fallback screen 1 appears (no CLOSED yet)
    closeCurrentOverlay();
    await vi.advanceTimersByTimeAsync(10);
    expect(urls.some((u) => u.includes('/load/fallbacks/imp-1'))).toBe(true);
    expect(overlayCount()).toBe(1); // fallback screen 1
    expect(currentOverlayHtml()).toContain('end screen 1');
    expect(events.map((e) => e.type)).not.toContain('CLOSED');

    // Kotlin parity: the fallback close is GATED 5s (countdown ring) — no
    // close button until the gate elapses
    expect(document.querySelector('button[aria-label="Close ad"]')).toBeNull();
    await vi.advanceTimersByTimeAsync(5000);

    // Close fallback 1 → fallback screen 2 (still no CLOSED)
    closeCurrentOverlay();
    await vi.advanceTimersByTimeAsync(10);
    expect(currentOverlayHtml()).toContain('end screen 2');
    expect(events.map((e) => e.type)).not.toContain('CLOSED');

    // Close fallback 2 (after its gate) → the flow completes: CLOSED fires
    await vi.advanceTimersByTimeAsync(5000);
    closeCurrentOverlay();
    await vi.advanceTimersByTimeAsync(10);
    expect(events.map((e) => e.type)).toContain('CLOSED');
    expect(overlayCount()).toBe(0);
    expect(isFullscreenActive()).toBe(false);
  });

  it('prefetches fallbacks WHILE the ad is on screen; close consumes the prefetch (no second request)', async () => {
    const urls = stubFetch();
    await init();

    const ad = new SimulaInterstitialAd('unit-1');
    const events: SimulaAdEvent[] = [];
    ad.addAdEventsListener((e) => events.push(e));
    ad.load();
    await new Promise((r) => setTimeout(r, 10));
    ad.show();
    await new Promise((r) => setTimeout(r, 5));

    // The prefetch fired on DISPLAYED — before any close interaction
    const fallbackRequestsBeforeClose = urls.filter((u) => u.includes('/load/fallbacks/')).length;
    expect(fallbackRequestsBeforeClose).toBe(1);

    closeCurrentOverlay();
    await new Promise((r) => setTimeout(r, 10));
    expect(currentOverlayHtml()).toContain('end screen 1'); // synchronous handoff

    // Close consumed the prefetch — no second fallbacks request
    expect(urls.filter((u) => u.includes('/load/fallbacks/')).length).toBe(1);
  });

  it('a slow prefetch still delivers the screens (awaits the in-flight request)', async () => {
    let resolveFallbacks: ((v: any) => void) | null = null;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: any) => {
        const url = String(input);
        if (url.includes('/session/create')) {
          return { ok: true, status: 200, json: async () => ({ sessionId: 'sess-1' }) } as any;
        }
        if (url.includes('/load/interstitial')) {
          return { ok: true, status: 200, json: async () => CREATIVE } as any;
        }
        if (url.includes('/load/fallbacks/imp-1')) {
          return new Promise((resolve) => {
            resolveFallbacks = resolve;
          });
        }
        return { ok: true, status: 200, json: async () => ({}) } as any;
      }),
    );
    await init();

    const ad = new SimulaInterstitialAd('unit-1');
    ad.addAdEventsListener(() => {});
    ad.load();
    await new Promise((r) => setTimeout(r, 10));
    ad.show();
    await new Promise((r) => setTimeout(r, 5));

    // Close while the prefetch is still in flight — the screen appears as soon as it lands
    closeCurrentOverlay();
    await new Promise((r) => setTimeout(r, 10));
    expect(overlayCount()).toBe(0); // waiting on the prefetch

    resolveFallbacks!({ ok: true, status: 200, json: async () => FALLBACKS });
    await new Promise((r) => setTimeout(r, 10));
    expect(currentOverlayHtml()).toContain('end screen 1');
  });

  it('no fallbacks → CLOSED fires immediately after the primary close', async () => {
    stubFetch({ impression_id: 'imp-1', ads: [] });
    await init();

    const ad = new SimulaInterstitialAd('unit-1');
    const events: SimulaAdEvent[] = [];
    ad.addAdEventsListener((e) => events.push(e));
    ad.load();
    await new Promise((r) => setTimeout(r, 10));
    ad.show();
    await new Promise((r) => setTimeout(r, 5));

    closeCurrentOverlay();
    await new Promise((r) => setTimeout(r, 10));
    expect(events.map((e) => e.type)).toContain('CLOSED');
    expect(overlayCount()).toBe(0);
  });

  it('fallback fetch failure → CLOSED still fires (fail-open)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: any) => {
        const url = String(input);
        if (url.includes('/session/create')) {
          return { ok: true, status: 200, json: async () => ({ sessionId: 'sess-1' }) } as any;
        }
        if (url.includes('/load/interstitial')) {
          return { ok: true, status: 200, json: async () => CREATIVE } as any;
        }
        if (url.includes('/load/fallbacks/')) {
          throw new Error('network down');
        }
        return { ok: true, status: 200, json: async () => ({}) } as any;
      }),
    );
    await init();

    const ad = new SimulaInterstitialAd('unit-1');
    const events: SimulaAdEvent[] = [];
    ad.addAdEventsListener((e) => events.push(e));
    ad.load();
    await new Promise((r) => setTimeout(r, 10));
    ad.show();
    await new Promise((r) => setTimeout(r, 5));

    closeCurrentOverlay();
    await new Promise((r) => setTimeout(r, 10));
    expect(events.map((e) => e.type)).toContain('CLOSED');
    expect(overlayCount()).toBe(0);
  });

  /** Fetch stub whose /load/fallbacks hangs until manually resolved. */
  function stubHangingFallbacks(): { urls: string[]; resolveFallbacks: () => void } {
    let resolver: ((v: any) => void) | null = null;
    const urls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: any) => {
        const url = String(input);
        urls.push(url);
        if (url.includes('/session/create')) {
          return { ok: true, status: 200, json: async () => ({ sessionId: 'sess-1' }) } as any;
        }
        if (url.includes('/load/interstitial')) {
          return { ok: true, status: 200, json: async () => CREATIVE } as any;
        }
        if (url.includes('/load/fallbacks/')) {
          return new Promise((resolve) => {
            resolver = resolve;
          });
        }
        return { ok: true, status: 200, json: async () => ({}) } as any;
      }),
    );
    return {
      urls,
      resolveFallbacks: () => resolver?.({ ok: true, status: 200, json: async () => FALLBACKS }),
    };
  }

  async function loadAndShowWithEvents(): Promise<{ ad: SimulaInterstitialAd; events: SimulaAdEvent[] }> {
    const ad = new SimulaInterstitialAd('unit-1');
    const events: SimulaAdEvent[] = [];
    ad.addAdEventsListener((e) => events.push(e));
    ad.load();
    await new Promise((r) => setTimeout(r, 10));
    ad.show();
    await new Promise((r) => setTimeout(r, 5));
    return { ad, events };
  }

  it('a fetch stalled beyond the wait cap → CLOSED fires; no surprise overlay later', async () => {
    const { resolveFallbacks } = stubHangingFallbacks();
    await init();

    const ad = new SimulaInterstitialAd('unit-1');
    const events: SimulaAdEvent[] = [];
    ad.addAdEventsListener((e) => events.push(e));
    ad.load();
    await new Promise((r) => setTimeout(r, 10));
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'setInterval'] });
    ad.show();
    await vi.advanceTimersByTimeAsync(5);

    closeCurrentOverlay();
    // Past the 1.5s cap the flow gives up on fallbacks and completes
    await vi.advanceTimersByTimeAsync(1600);
    expect(events.map((e) => e.type)).toContain('CLOSED');
    expect(overlayCount()).toBe(0);

    // The fetch finally lands — nothing pops up out of nowhere
    resolveFallbacks();
    await vi.advanceTimersByTimeAsync(50);
    expect(overlayCount()).toBe(0);
    expect(events.filter((e) => e.type === 'CLOSED')).toHaveLength(1);
  });

  it('a new presentation during the fallback wait is never hijacked', async () => {
    const { resolveFallbacks } = stubHangingFallbacks();
    await init();
    const { ad, events } = await loadAndShowWithEvents();

    // Primary closed; the flow is awaiting the fallback fetch — page interactive
    closeCurrentOverlay();
    await new Promise((r) => setTimeout(r, 10));
    expect(overlayCount()).toBe(0);

    // Another presentation takes the mutex during the wait
    const other = new SimulaInterstitialAd('unit-2');
    const preview = other.showPreview({ closeTreatment: 'hidden', delaySeconds: 0 });
    expect(overlayCount()).toBe(1);

    // The fetch lands — the flow must NOT displace the newer presentation
    resolveFallbacks();
    await new Promise((r) => setTimeout(r, 10));
    expect(currentOverlayHtml()).toContain('Simula Ad Preview'); // untouched
    expect(events.map((e) => e.type)).toContain('CLOSED'); // flow completed without fallbacks

    preview?.close();
    ad.destroy();
    other.destroy();
  });

  it('destroy() during the fallback wait still delivers CLOSED, exactly once', async () => {
    const { resolveFallbacks } = stubHangingFallbacks();
    await init();
    const { ad, events } = await loadAndShowWithEvents();

    closeCurrentOverlay();
    await new Promise((r) => setTimeout(r, 10));
    expect(events.map((e) => e.type)).not.toContain('CLOSED'); // flow waiting

    ad.destroy();
    expect(events.map((e) => e.type)).toContain('CLOSED'); // delivered before listeners detach

    // The late fetch resolution neither double-fires nor mounts anything
    resolveFallbacks();
    await new Promise((r) => setTimeout(r, 10));
    expect(events.filter((e) => e.type === 'CLOSED')).toHaveLength(1);
    expect(overlayCount()).toBe(0);
  });

  it('auto_store_redirect fires on the matching end-screen moment', async () => {
    const openSpy = vi.fn();
    vi.stubGlobal('open', openSpy);
    const creativeWithAsr = {
      ...CREATIVE,
      tracking_url: 'https://track.test/app',
      ad_behavior: { close: { delay_seconds: 0 }, auto_store_redirect: { enabled: true, trigger: 'end_screen_1_open' } },
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: any) => {
        const url = String(input);
        if (url.includes('/session/create')) {
          return { ok: true, status: 200, json: async () => ({ sessionId: 'sess-1' }) } as any;
        }
        if (url.includes('/load/interstitial')) {
          return { ok: true, status: 200, json: async () => creativeWithAsr } as any;
        }
        if (url.includes('/load/fallbacks/imp-1')) {
          return { ok: true, status: 200, json: async () => FALLBACKS } as any;
        }
        return { ok: true, status: 200, json: async () => ({}) } as any;
      }),
    );
    await init();

    const ad = new SimulaInterstitialAd('unit-1');
    ad.addAdEventsListener(() => {});
    ad.load();
    await new Promise((r) => setTimeout(r, 10));
    ad.show();
    await new Promise((r) => setTimeout(r, 5));

    closeCurrentOverlay();
    await new Promise((r) => setTimeout(r, 10));

    // End screen 1 displayed → the auto redirect opened the tracking URL once
    expect(openSpy).toHaveBeenCalledWith('https://track.test/app', '_blank', 'noopener');
    vi.unstubAllGlobals();
  });
});
