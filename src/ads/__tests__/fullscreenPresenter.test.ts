// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { presentFullscreenAd } from '../fullscreenPresenter';
import { LoadedCreative } from '../../utils/api';

function makeCreative(overrides: Partial<LoadedCreative> = {}): LoadedCreative {
  return {
    impressionId: 'imp-1',
    renderedHtml: '<html><body>ad</body></html>',
    destination: 'web',
    bidAmt: 5,
    adBehavior: null,
    ...overrides,
  };
}

function makeHandlers() {
  return {
    onDisplayed: vi.fn(),
    onImpression: vi.fn(),
    onCtaClick: vi.fn(),
    onClose: vi.fn(),
    onRewardGateElapsed: vi.fn(),
    onCreativeMoment: vi.fn(),
  };
}

function overlay(): HTMLElement | null {
  return document.querySelector('[data-simula-fullscreen-ad]');
}

/** jsdom's visibilityState is a getter — override per test. */
function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
}

describe('fullscreenPresenter (DOM paths)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.documentElement.style.overflow = '';
    setVisibility('visible');
  });

  afterEach(() => {
    document.body.innerHTML = '';
    document.documentElement.style.overflow = '';
    setVisibility('visible');
    vi.useRealTimers();
  });

  it('mounts the overlay and fires onDisplayed immediately', () => {
    const handlers = makeHandlers();
    presentFullscreenAd({ creative: makeCreative(), adUnitType: 'interstitial', handlers });
    expect(overlay()).not.toBeNull();
    expect(handlers.onDisplayed).toHaveBeenCalledTimes(1);
  });

  it('shows the close ✕ immediately when delay is 0, and closes exactly once', () => {
    const handlers = makeHandlers();
    presentFullscreenAd({ creative: makeCreative(), adUnitType: 'interstitial', handlers });
    const btn = document.querySelector('button[aria-label="Close ad"]') as HTMLButtonElement;
    expect(btn).not.toBeNull();
    btn.click();
    expect(overlay()).toBeNull();
    expect(handlers.onClose).toHaveBeenCalledTimes(1);
  });

  it('gates the close affordance for delaySeconds, then reveals ✕', () => {
    vi.useFakeTimers();
    const handlers = makeHandlers();
    const creative = makeCreative({
      adBehavior: { close: { delaySeconds: 5, treatment: 'hidden', position: 'top_right', progressBarColor: '#FFFFFF' }, storeOpen: 'external' },
    });
    presentFullscreenAd({ creative, adUnitType: 'interstitial', handlers });

    // During the gate: hidden treatment → no affordance at all
    expect(document.querySelector('button[aria-label="Close ad"]')).toBeNull();

    // ESC during the gate is blocked
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(overlay()).not.toBeNull();

    vi.advanceTimersByTime(5000);
    expect(document.querySelector('button[aria-label="Close ad"]')).not.toBeNull();

    // ESC works after the gate
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(overlay()).toBeNull();
    expect(handlers.onClose).toHaveBeenCalledTimes(1);
  });

  it('renders the countdown_circle treatment during the gate', () => {
    vi.useFakeTimers();
    const handlers = makeHandlers();
    const creative = makeCreative({
      adBehavior: { close: { delaySeconds: 10, treatment: 'countdown_circle', position: 'top_left', progressBarColor: '#FF0000' }, storeOpen: 'external' },
    });
    presentFullscreenAd({ creative, adUnitType: 'interstitial', handlers });
    expect(document.querySelector('svg')).not.toBeNull();
    vi.advanceTimersByTime(10000);
    expect(document.querySelector('button[aria-label="Close ad"]')).not.toBeNull();
  });

  it('renders the progress_bar treatment tinted with progressBarColor', () => {
    vi.useFakeTimers();
    const handlers = makeHandlers();
    const creative = makeCreative({
      adBehavior: { close: { delaySeconds: 10, treatment: 'progress_bar', position: 'top_right', progressBarColor: '#00FF00' }, storeOpen: 'external' },
    });
    presentFullscreenAd({ creative, adUnitType: 'interstitial', handlers });
    const bars = document.querySelectorAll('div[style*="background: rgb(0, 255, 0)"], div[style*="background:#00FF00"], div[style*="#00FF00"]');
    expect(bars.length).toBeGreaterThan(0);
  });

  it('renders reward_or_close_label with rewarded copy', () => {
    vi.useFakeTimers();
    const handlers = makeHandlers();
    const creative = makeCreative({
      adBehavior: { close: { delaySeconds: 8, treatment: 'reward_or_close_label', position: 'top_right', progressBarColor: '#FFFFFF' }, storeOpen: 'external' },
    });
    presentFullscreenAd({ creative, adUnitType: 'rewarded', handlers });
    expect(document.body.textContent).toContain('Reward in 8s');
  });

  it('fires onRewardGateElapsed + playable_end moment when the gate elapses', () => {
    vi.useFakeTimers();
    const handlers = makeHandlers();
    const creative = makeCreative({
      adBehavior: { close: { delaySeconds: 3, treatment: 'hidden', position: 'top_right', progressBarColor: '#FFFFFF' }, storeOpen: 'external' },
    });
    presentFullscreenAd({ creative, adUnitType: 'rewarded', handlers });
    expect(handlers.onRewardGateElapsed).not.toHaveBeenCalled();
    vi.advanceTimersByTime(3000);
    expect(handlers.onRewardGateElapsed).toHaveBeenCalledTimes(1);
    expect(handlers.onCreativeMoment).toHaveBeenCalledWith('playable_end');
  });

  it('fires onImpression ~2s after the creative load event (billable)', () => {
    vi.useFakeTimers();
    const handlers = makeHandlers();
    presentFullscreenAd({ creative: makeCreative(), adUnitType: 'interstitial', handlers });
    const iframe = document.querySelector('iframe') as HTMLIFrameElement;
    iframe.dispatchEvent(new Event('load'));
    expect(handlers.onImpression).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2000);
    expect(handlers.onImpression).toHaveBeenCalledTimes(1);
  });

  it('routes a creative CTA_CLICK bridge message to onCtaClick', () => {
    const handlers = makeHandlers();
    presentFullscreenAd({ creative: makeCreative(), adUnitType: 'interstitial', handlers });
    const iframe = document.querySelector('iframe') as HTMLIFrameElement;

    // jsdom can't set contentWindow on srcdoc iframes reliably — simulate via the window message path
    const evt = new MessageEvent('message', {
      data: { type: 'CTA_CLICK', payload: { url: 'https://store.test/app', handled: true } },
      source: iframe.contentWindow,
    } as any);
    window.dispatchEvent(evt);

    expect(handlers.onCtaClick).toHaveBeenCalledWith('https://store.test/app', true);
  });

  it('AD_EARLY_COMPLETE closes the ad', () => {
    const handlers = makeHandlers();
    presentFullscreenAd({ creative: makeCreative(), adUnitType: 'interstitial', handlers });
    const iframe = document.querySelector('iframe') as HTMLIFrameElement;
    window.dispatchEvent(new MessageEvent('message', { data: { type: 'AD_EARLY_COMPLETE' }, source: iframe.contentWindow } as any));
    expect(overlay()).toBeNull();
    expect(handlers.onClose).toHaveBeenCalledTimes(1);
  });

  it('ignores bridge messages from other sources', () => {
    const handlers = makeHandlers();
    presentFullscreenAd({ creative: makeCreative(), adUnitType: 'interstitial', handlers });
    window.dispatchEvent(new MessageEvent('message', { data: { type: 'AD_EARLY_COMPLETE' }, source: window } as any));
    expect(overlay()).not.toBeNull();
  });

  it('returns null without a renderable creative', () => {
    const handlers = makeHandlers();
    const handle = presentFullscreenAd({
      creative: { impressionId: 'x', destination: 'web', bidAmt: 0, adBehavior: null },
      adUnitType: 'interstitial',
      handlers,
    });
    expect(handle).toBeNull();
    expect(overlay()).toBeNull();
  });

  it('locks body scroll while open and restores on close', () => {
    const handlers = makeHandlers();
    presentFullscreenAd({ creative: makeCreative(), adUnitType: 'interstitial', handlers });
    expect(document.documentElement.style.overflow).toBe('hidden');
    (document.querySelector('button[aria-label="Close ad"]') as HTMLButtonElement).click();
    expect(document.documentElement.style.overflow).toBe('');
  });

  it('preserves a pre-existing host overflow style (never wipes it)', () => {
    document.documentElement.style.overflow = 'auto';
    const handlers = makeHandlers();
    presentFullscreenAd({ creative: makeCreative(), adUnitType: 'interstitial', handlers });
    expect(document.documentElement.style.overflow).toBe('hidden');
    (document.querySelector('button[aria-label="Close ad"]') as HTMLButtonElement).click();
    expect(document.documentElement.style.overflow).toBe('auto');
  });

  it('impression timer only accrues FOREGROUND time (native parity)', () => {
    vi.useFakeTimers();
    const handlers = makeHandlers();
    presentFullscreenAd({ creative: makeCreative(), adUnitType: 'interstitial', handlers });
    const iframe = document.querySelector('iframe') as HTMLIFrameElement;
    iframe.dispatchEvent(new Event('load'));

    // 1.5s of the 2s requirement accrues, then the tab hides
    vi.advanceTimersByTime(1500);
    setVisibility('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    vi.advanceTimersByTime(5000); // hidden time must NOT count
    expect(handlers.onImpression).not.toHaveBeenCalled();

    // Back to foreground — the remaining ~0.5s accrues
    setVisibility('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    vi.advanceTimersByTime(600);
    expect(handlers.onImpression).toHaveBeenCalledTimes(1);
  });

  it('the reward gate countdown pauses while hidden', () => {
    vi.useFakeTimers();
    const handlers = makeHandlers();
    const creative = makeCreative({
      adBehavior: { close: { delaySeconds: 5, treatment: 'hidden', position: 'top_right', progressBarColor: '#FFFFFF' }, storeOpen: 'external' },
    });
    presentFullscreenAd({ creative, adUnitType: 'rewarded', handlers });

    vi.advanceTimersByTime(2000); // 3s left
    setVisibility('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    vi.advanceTimersByTime(10000); // frozen — gate must not elapse while hidden
    expect(handlers.onRewardGateElapsed).not.toHaveBeenCalled();

    setVisibility('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    vi.advanceTimersByTime(3000); // remaining 3s accrue
    expect(handlers.onRewardGateElapsed).toHaveBeenCalledTimes(1);
  });

  it('onClose reports foreground dwell, not wall-clock time', () => {
    vi.useFakeTimers();
    const handlers = makeHandlers();
    const handle = presentFullscreenAd({ creative: makeCreative(), adUnitType: 'interstitial', handlers });
    vi.advanceTimersByTime(2000);
    setVisibility('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    vi.advanceTimersByTime(8000); // hidden — excluded from dwell
    handle?.close();
    expect(handlers.onClose).toHaveBeenCalledWith(2);
  });

  it('programmatic close via the handle reports elapsed seconds', () => {
    vi.useFakeTimers();
    const handlers = makeHandlers();
    const handle = presentFullscreenAd({ creative: makeCreative(), adUnitType: 'interstitial', handlers });
    vi.advanceTimersByTime(7000);
    handle?.close();
    expect(handlers.onClose).toHaveBeenCalledWith(7);
  });
});
