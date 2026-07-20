import { SimulaAds } from '../core/SimulaAds';
import { SessionManager } from '../core/session';
import { Telemetry } from '../telemetry/telemetry';
import { adValueFromBidCpm } from '../core/adValue';
import { CharacterTargeting, LoadedCreative } from '../utils/api';
import { SimulaAdError } from './errors';
import { SimulaAdEventType, SimulaRewardedAdEventType, AnyAdEventType, SimulaAdEvent, SimulaAdEventListener, SimulaUnsubscribe } from './events';
import { AdUnitType, MAX_CLOSE_DELAY_SECONDS } from './adBehavior';
import { presentFullscreenAd, FullscreenPresenterHandle } from './fullscreenPresenter';
import { logger } from '../utils/logger';

/** Loaded ads expire after 1 hour (native parity: STALE_AFTER_MS). */
const STALE_AFTER_MS = 60 * 60 * 1000;
/** Same-key re-loads are dedup-blocked for 5 minutes (native parity: DEDUP_WINDOW_MS). */
const DEDUP_WINDOW_MS = 5 * 60 * 1000;

export type SimulaAdLoadOptions = CharacterTargeting;

interface LoadedAd {
  creative: LoadedCreative;
  loadedAtMs: number;
  sessionId: string;
  targeting: SimulaAdLoadOptions;
}

interface DedupEntry {
  state: 'loading' | 'ready';
  atMs: number;
}

/** Process-wide dedup registry (native parity: same adUnit+char+session key is throttled 5 min). */
const dedupRegistry = new Map<string, DedupEntry>();

/** Only one fullscreen ad may be on screen at a time (native parity: AlreadyShowing). */
let fullscreenActive = false;

/** Test hook. Not public API. */
export function _resetAdDedupForTests(): void {
  dedupRegistry.clear();
  fullscreenActive = false;
}

function dedupKey(adUnitId: string, targeting: SimulaAdLoadOptions, sessionId: string): string {
  return `${adUnitId}|${targeting.charId ?? ''}|${targeting.charName ?? ''}|${sessionId}`;
}

/**
 * Shared state machine for imperative full-screen ads (interstitial/rewarded).
 * Mirrors the native ad classes: load/show lifecycle, 1h staleness, 5-min
 * dedup window, one-at-a-time presentation, and the three-signal event model
 * (DISPLAYED = shown, IMPRESSION = billable ~2s after render, PAID co-fired).
 * All outcomes arrive as events; load/show are fire-and-forget.
 */
export abstract class SimulaBaseAd {
  readonly adUnitId: string;
  protected abstract readonly adFormat: 'interstitial' | 'rewarded';
  protected abstract readonly adUnitType: AdUnitType;

  private get displayName(): string {
    return this.adFormat === 'rewarded' ? 'SimulaRewardedAd' : 'SimulaInterstitialAd';
  }

  private loadedAd: LoadedAd | null = null;
  private loadingPromise: Promise<void> | null = null;
  private presenter: FullscreenPresenterHandle | null = null;
  private destroyed = false;
  private typedListeners = new Map<AnyAdEventType, Set<(event: SimulaAdEvent) => void>>();
  private allListeners = new Set<(event: SimulaAdEvent) => void>();

  constructor(adUnitId: string) {
    this.adUnitId = adUnitId;
  }

  get loaded(): boolean {
    return this.loadedAd !== null;
  }

  /** Fetch the creative (fire-and-forget — outcomes arrive as LOADED / LOAD_FAILED). */
  load(options: SimulaAdLoadOptions = {}): void {
    if (this.destroyed) {
      logger.warn(`${this.displayName}: load() called after destroy() — no-op`);
      return;
    }
    if (this.loadingPromise) {
      this.emit(SimulaAdEventType.LOAD_FAILED, { error: SimulaAdError.duplicateLoading() });
      return;
    }
    this.loadingPromise = this.doLoadFlow(options).finally(() => {
      this.loadingPromise = null;
    });
  }

  /** Present the loaded creative (fire-and-forget — outcomes arrive as events). */
  show(): void {
    if (this.destroyed) {
      logger.warn(`${this.displayName}: show() called after destroy() — no-op`);
      return;
    }
    if (!SimulaAds.isInitialized()) {
      this.emit(SimulaAdEventType.DISPLAY_FAILED, { error: SimulaAdError.notInitialized() });
      return;
    }
    const ad = this.loadedAd;
    if (!ad) {
      this.emit(SimulaAdEventType.DISPLAY_FAILED, { error: SimulaAdError.notReady() });
      return;
    }
    if (Date.now() - ad.loadedAtMs > STALE_AFTER_MS) {
      this.loadedAd = null;
      this.emit(SimulaAdEventType.DISPLAY_FAILED, { error: SimulaAdError.stale() });
      return;
    }
    if (fullscreenActive) {
      this.emit(SimulaAdEventType.DISPLAY_FAILED, { error: SimulaAdError.alreadyShowing() });
      return;
    }

    const handle = this.present(ad);
    if (!handle) {
      this.emit(SimulaAdEventType.DISPLAY_FAILED, { error: SimulaAdError.noPresentationContext() });
      Telemetry.recordLifecycle('show_fail', { adFormat: this.adFormat, adUnitId: this.adUnitId, adId: ad.creative.impressionId, errorCode: 'no_presentation_context' });
      return;
    }
    fullscreenActive = true;
    this.presenter = handle;
  }

  /** Idempotent teardown. A showing ad is closed programmatically. */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.loadedAd = null;
    this.removeAllListeners();
    const presenter = this.presenter;
    this.presenter = null;
    if (presenter) presenter.close(); // CLOSED fires before listeners detach? No — listeners already removed
  }

  addAdEventListener(type: AnyAdEventType, listener: (event: SimulaAdEvent) => void): SimulaUnsubscribe {
    let set = this.typedListeners.get(type);
    if (!set) {
      set = new Set();
      this.typedListeners.set(type, set);
    }
    set.add(listener);
    return () => set.delete(listener);
  }

  addAdEventsListener(listener: SimulaAdEventListener): SimulaUnsubscribe {
    this.allListeners.add(listener);
    return () => this.allListeners.delete(listener);
  }

  removeAllListeners(): void {
    this.typedListeners.clear();
    this.allListeners.clear();
  }

  protected emit(type: AnyAdEventType, payload: Omit<SimulaAdEvent, 'type'> = {}): void {
    const event: SimulaAdEvent = { type, ...payload };
    const deliver = (listener: (event: SimulaAdEvent) => void) => {
      try {
        listener(event);
      } catch (error) {
        logger.warn(`${this.displayName}: a host event listener threw (swallowed):`, error);
      }
    };
    this.typedListeners.get(type)?.forEach(deliver);
    this.allListeners.forEach(deliver);
  }

  // ── Internals ────────────────────────────────────────────────────────────

  private async doLoadFlow(options: SimulaAdLoadOptions): Promise<void> {
    const startedAt = Date.now();
    if (!SimulaAds.isInitialized()) {
      this.emit(SimulaAdEventType.LOAD_FAILED, { error: SimulaAdError.notInitialized() });
      return;
    }

    const sessionId = await SessionManager.ensureSession();
    if (!sessionId) {
      const error = SimulaAdError.noSession();
      this.emit(SimulaAdEventType.LOAD_FAILED, { error });
      Telemetry.recordLifecycle('load_fail', { adFormat: this.adFormat, adUnitId: this.adUnitId, durationMs: Date.now() - startedAt, errorCode: error.code });
      return;
    }

    // Dedup window (native parity): same ad unit + character + session key
    const key = dedupKey(this.adUnitId, options, sessionId);
    const existing = dedupRegistry.get(key);
    if (existing) {
      if (existing.state === 'loading') {
        this.emit(SimulaAdEventType.LOAD_FAILED, { error: SimulaAdError.duplicateLoading() });
        return;
      }
      const elapsed = Date.now() - existing.atMs;
      if (elapsed < DEDUP_WINDOW_MS) {
        const remainingSec = Math.ceil((DEDUP_WINDOW_MS - elapsed) / 1000);
        this.emit(SimulaAdEventType.LOAD_FAILED, { error: SimulaAdError.duplicateReady(remainingSec) });
        return;
      }
    }

    dedupRegistry.set(key, { state: 'loading', atMs: startedAt });
    const result = await this.fetchCreative(sessionId, options);

    if (result.error || !result.creative) {
      dedupRegistry.delete(key);
      const error = result.error ?? SimulaAdError.noFill();
      this.emit(SimulaAdEventType.LOAD_FAILED, { error });
      Telemetry.recordLifecycle('load_fail', { adFormat: this.adFormat, adUnitId: this.adUnitId, durationMs: Date.now() - startedAt, errorCode: error.code });
      return;
    }

    dedupRegistry.set(key, { state: 'ready', atMs: Date.now() });
    this.loadedAd = { creative: result.creative, loadedAtMs: Date.now(), sessionId, targeting: options };
    this.emit(SimulaAdEventType.LOADED);
    Telemetry.recordLifecycle('load_success', { adFormat: this.adFormat, adUnitId: this.adUnitId, adId: result.creative.impressionId, durationMs: Date.now() - startedAt, cacheSource: 'network' });
  }

  /** Force-load bypassing the dedup window (used by auto-preload after close — native parity). */
  protected preloadNext(): void {
    const targeting = this.loadedAd?.targeting ?? {};
    this.loadNextInternal(targeting);
  }

  private loadNextInternal(targeting: SimulaAdLoadOptions): void {
    if (this.destroyed || !SimulaAds.isInitialized()) return;
    void (async () => {
      const sessionId = await SessionManager.ensureSession();
      if (!sessionId || this.destroyed) return;
      const result = await this.fetchCreative(sessionId, targeting);
      if (result.creative && !this.destroyed) {
        this.loadedAd = { creative: result.creative, loadedAtMs: Date.now(), sessionId, targeting };
      }
    })();
  }

  private present(ad: LoadedAd): FullscreenPresenterHandle | null {
    const creative = ad.creative;
    return presentFullscreenAd({
      creative,
      adUnitType: this.adUnitType,
      handlers: {
        onDisplayed: () => {
          this.emit(SimulaAdEventType.DISPLAYED);
          Telemetry.recordLifecycle('displayed', { adFormat: this.adFormat, adUnitId: this.adUnitId, adId: creative.impressionId });
        },
        onImpression: () => {
          this.emit(SimulaAdEventType.IMPRESSION);
          const adValue = adValueFromBidCpm(creative.bidAmt);
          this.emit(SimulaAdEventType.PAID, { adValue });
          Telemetry.recordLifecycle('impression', { adFormat: this.adFormat, adUnitId: this.adUnitId, adId: creative.impressionId });
          Telemetry.recordLifecycle('paid', { adFormat: this.adFormat, adUnitId: this.adUnitId, adId: creative.impressionId });
          this.onBillableImpression(ad);
        },
        onCtaClick: (url) => {
          this.emit(SimulaAdEventType.CLICKED);
          Telemetry.recordLifecycle('click', { adFormat: this.adFormat, adUnitId: this.adUnitId, adId: creative.impressionId });
          const target = url ?? creative.trackingUrl ?? creative.storeUrl;
          if (target) {
            try {
              window.open(target, '_blank', 'noopener');
            } catch {
              // Popup blocked — the click event already fired
            }
          }
        },
        onClose: (elapsedSeconds) => {
          fullscreenActive = false;
          this.presenter = null;
          this.loadedAd = null;
          this.emit(SimulaAdEventType.CLOSED);
          Telemetry.recordLifecycle('closed', { adFormat: this.adFormat, adUnitId: this.adUnitId, adId: creative.impressionId, durationMs: elapsedSeconds * 1000 });
          this.onAdClosed(ad, elapsedSeconds);
        },
        onRewardGateElapsed: () => this.onRewardGateElapsed(ad),
        onCreativeMoment: (moment) => this.onCreativeMoment(ad, moment),
      },
    });
  }

  /** Auto store redirect (server-driven): opens the CTA destination once per impression. */
  protected onCreativeMoment(ad: LoadedAd, moment: string): void {
    const asr = ad.creative.adBehavior?.autoStoreRedirect;
    if (!asr?.enabled || asr.trigger !== moment) return;
    const target = ad.creative.trackingUrl ?? ad.creative.storeUrl;
    if (!target) return;
    try {
      window.open(target, '_blank', 'noopener');
      Telemetry.recordLifecycle('store_opened', { adFormat: this.adFormat, adUnitId: this.adUnitId, adId: ad.creative.impressionId, trigger: 'auto_redirect' });
    } catch {
      // Popup blocked without a user gesture — nothing to do
    }
  }

  /** Hooks for subclasses. */
  protected onBillableImpression(_ad: LoadedAd): void {}
  protected onRewardGateElapsed(_ad: LoadedAd): void {}
  protected onAdClosed(_ad: LoadedAd, _elapsedSeconds: number): void {}

  /** The format-specific network call. */
  protected abstract fetchCreative(
    sessionId: string,
    targeting: SimulaAdLoadOptions,
  ): Promise<{ creative?: LoadedCreative; error?: SimulaAdError }>;
}
