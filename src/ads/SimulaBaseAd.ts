import { SimulaAds } from '../core/SimulaAds';
import { SessionManager } from '../core/session';
import { Telemetry } from '../telemetry/telemetry';
import { adValueFromBidCpm } from '../core/adValue';
import { CharacterTargeting, LoadedCreative, FallbackAdScreen, fetchFallbackAds } from '../utils/api';
import { SimulaAdError } from './errors';
import { SimulaAdEventType, AnyAdEventType, SimulaAdEvent, SimulaAdEventListener, SimulaUnsubscribe } from './events';
import { AdUnitType, CloseBehavior } from './adBehavior';
import { presentFullscreenAd, isFullscreenActive, FullscreenPresenterHandle } from './fullscreenPresenter';
import { logger } from '../utils/logger';

/**
 * Cap on how long the close flow waits for the fallback-screens fetch. The
 * prefetch (kicked off at DISPLAYED) is virtually always resolved by close
 * time; this bound only matters when the user closes within one RTT of the
 * display. Past it the flow completes without fallbacks — the page is
 * interactive during the wait, and a fallback overlay popping up seconds
 * later would hijack the user mid-interaction.
 */
const FALLBACK_WAIT_CAP_MS = 1_500;

/**
 * Close chrome for fallback screens (Kotlin parity: FallbackAdOverlay's 5s
 * countdown ring resolving to a top-right close button). The presenter's
 * visibility-gated countdown gives the same foreground-only dwell.
 */
const FALLBACK_CLOSE_BEHAVIOR: CloseBehavior = {
  delaySeconds: 5,
  treatment: 'countdown_circle',
  position: 'top_right',
  progressBarColor: '#FFFFFF',
};

/** Resolve with `fallback` when `promise` hasn't settled within `ms`. Never rejects. */
function raceWithTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}

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

/** Per-instance load state (Kotlin parity: Idle | Loading | Ready | Showing). */
type LoadState = 'idle' | 'loading' | 'ready' | 'showing';

/**
 * Shared state machine for imperative full-screen ads (interstitial/rewarded).
 * Mirrors the Kotlin ad classes exactly:
 *
 * - **Per-instance dedup** keyed (ad unit, char id, char name, session id):
 *   a same-key re-load within 5 minutes reports `duplicate_request`; a
 *   **different** key supersedes the in-flight/ready ad and starts fresh.
 * - **Staleness**: a loaded ad expires after 1 hour (`show()` → `stale`).
 * - **No-op while showing**: `load()` on screen is silently ignored — the
 *   next ad is preloaded automatically on close (replaying the last targeting).
 * - **Three-signal events**: DISPLAYED = shown, IMPRESSION = billable ~2s of
 *   foreground time after render, PAID (AdValue) co-fired with IMPRESSION.
 * All outcomes arrive as events; load/show are fire-and-forget.
 */
export abstract class SimulaBaseAd {
  readonly adUnitId: string;
  protected abstract readonly adFormat: 'interstitial' | 'rewarded';
  protected abstract readonly adUnitType: AdUnitType;

  private get displayName(): string {
    return this.adFormat === 'rewarded' ? 'SimulaRewardedAd' : 'SimulaInterstitialAd';
  }

  private state: LoadState = 'idle';
  /** The (ad unit, char, session) key of the load in flight or ready. */
  private currentKey = '';
  private currentKeyAtMs = 0;
  /** Bumped on every supersede/destroy — stale async completions are dropped. */
  private loadGeneration = 0;

  private loadedAd: LoadedAd | null = null;
  private presenter: FullscreenPresenterHandle | null = null;
  private destroyed = false;
  private typedListeners = new Map<AnyAdEventType, Set<(event: SimulaAdEvent) => void>>();
  private allListeners = new Set<(event: SimulaAdEvent) => void>();
  /** Last load() targeting — replayed verbatim on the post-close auto-preload (Kotlin parity). */
  private lastTargeting: SimulaAdLoadOptions = {};
  /** In-flight fallback-screen prefetch, kicked off while the primary ad is on screen. */
  private fallbackPrefetch: { impressionId: string; promise: Promise<FallbackAdScreen[]> } | null = null;
  /**
   * The close flow in progress: set when the primary presentation closes,
   * consumed exactly once by finishClose. Lets destroy() complete a flow
   * stranded mid-fallback-wait so the host never misses CLOSED.
   */
  private pendingClose: { ad: LoadedAd; elapsedSeconds: number } | null = null;

  constructor(adUnitId: string) {
    this.adUnitId = adUnitId;
  }

  get loaded(): boolean {
    return this.state === 'ready' && this.loadedAd !== null;
  }

  private dedupKey(targeting: SimulaAdLoadOptions): string {
    return `${this.adUnitId}|${targeting.charId ?? ''}|${targeting.charName ?? ''}|${SessionManager.getSessionId() ?? ''}`;
  }

  /** Fetch the creative (fire-and-forget — outcomes arrive as LOADED / LOAD_FAILED). */
  load(options: SimulaAdLoadOptions = {}): void {
    if (this.destroyed) {
      logger.warn(`${this.displayName}: load() called after destroy() — no-op`);
      return;
    }
    if (!SimulaAds.isInitialized()) {
      this.emit(SimulaAdEventType.LOAD_FAILED, { error: SimulaAdError.notInitialized() });
      return;
    }

    // Replay this targeting on the post-close auto-preload (Kotlin parity)
    this.lastTargeting = options;
    const key = this.dedupKey(options);

    switch (this.state) {
      // An ad is on screen — the next one preloads on close. Silent no-op.
      case 'showing':
        return;
      // A matching ad is already loading/ready: block a same-key re-load
      // within the dedup window; a different key falls through and supersedes.
      case 'loading':
      case 'ready':
        if (this.currentKey === key && Date.now() - this.currentKeyAtMs < DEDUP_WINDOW_MS) {
          const error =
            this.state === 'ready'
              ? SimulaAdError.duplicateReady(Math.ceil((DEDUP_WINDOW_MS - (Date.now() - this.currentKeyAtMs)) / 1000))
              : SimulaAdError.duplicateLoading();
          this.emit(SimulaAdEventType.LOAD_FAILED, { error });
          return;
        }
        break;
      case 'idle':
        break;
    }

    // Supersede any in-flight load / discard any ready ad, then start fresh
    const generation = ++this.loadGeneration;
    this.currentKey = key;
    this.currentKeyAtMs = Date.now();
    this.loadedAd = null;
    this.fallbackPrefetch = null;
    this.state = 'loading';
    void this.doLoadFlow(options, generation);
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
    if (this.state !== 'ready' || !ad) {
      this.emit(SimulaAdEventType.DISPLAY_FAILED, { error: SimulaAdError.notReady() });
      return;
    }
    if (Date.now() - ad.loadedAtMs > STALE_AFTER_MS) {
      this.loadedAd = null;
      this.state = 'idle';
      this.emit(SimulaAdEventType.DISPLAY_FAILED, { error: SimulaAdError.stale() });
      return;
    }
    if (isFullscreenActive()) {
      this.emit(SimulaAdEventType.DISPLAY_FAILED, { error: SimulaAdError.alreadyShowing() });
      return;
    }

    const handle = this.present(ad);
    if (!handle) {
      this.emit(SimulaAdEventType.DISPLAY_FAILED, { error: SimulaAdError.noPresentationContext() });
      Telemetry.recordLifecycle('show_fail', { adFormat: this.adFormat, adUnitId: this.adUnitId, adId: ad.creative.impressionId, errorCode: 'no_presentation_context' });
      return;
    }
    this.state = 'showing';
    this.presenter = handle;
  }

  /**
   * Idempotent teardown. A showing ad is closed FIRST (so the host still
   * receives CLOSED), then listeners are detached.
   */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.loadGeneration++; // invalidate any in-flight load
    const presenter = this.presenter;
    this.presenter = null;
    this.fallbackPrefetch = null;
    if (presenter) presenter.close(); // CLOSED fires while listeners are still attached
    // A close flow stranded mid-fallback-wait (presenter already torn down,
    // fetch still pending) still owes the host its CLOSED — complete it now,
    // while listeners are attached. No-op when nothing is pending.
    this.finishClose();
    this.loadedAd = null;
    this.state = 'idle';
    this.removeAllListeners();
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

  private async doLoadFlow(options: SimulaAdLoadOptions, generation: number): Promise<void> {
    const startedAt = Date.now();

    const sessionId = await SessionManager.ensureSession();
    if (this.destroyed || generation !== this.loadGeneration) return; // superseded / torn down
    if (!sessionId) {
      this.failLoad(SimulaAdError.noSession(), startedAt);
      return;
    }
    // The real session id is now known — refresh the dedup key (the synchronous
    // gate may have keyed on an empty session during cold-start warm-up). The
    // throttle timestamp intentionally stays at the original load time.
    this.currentKey = this.dedupKey(options);

    const result = await this.fetchCreative(sessionId, options);
    if (this.destroyed || generation !== this.loadGeneration) return; // superseded / torn down

    if (result.error || !result.creative) {
      this.failLoad(result.error ?? SimulaAdError.noFill(), startedAt);
      return;
    }

    this.loadedAd = { creative: result.creative, loadedAtMs: Date.now(), sessionId, targeting: options };
    this.state = 'ready';
    this.emit(SimulaAdEventType.LOADED);
    Telemetry.recordLifecycle('load_success', { adFormat: this.adFormat, adUnitId: this.adUnitId, adId: result.creative.impressionId, durationMs: Date.now() - startedAt, cacheSource: 'network' });
  }

  private failLoad(error: SimulaAdError, startedAt: number): void {
    this.state = 'idle';
    this.emit(SimulaAdEventType.LOAD_FAILED, { error });
    Telemetry.recordLifecycle('load_fail', { adFormat: this.adFormat, adUnitId: this.adUnitId, durationMs: Date.now() - startedAt, errorCode: error.code });
  }

  /**
   * Auto-preload of the next ad after close (Kotlin parity): replays the last
   * load() targeting, bypasses the dedup window, and refreshes the instance's
   * dedup entry so the following manual load() deduplicates correctly.
   */
  protected preloadNext(): void {
    if (this.destroyed || !SimulaAds.isInitialized() || this.state === 'showing') return;
    const targeting = this.lastTargeting;
    const generation = ++this.loadGeneration;
    this.currentKey = this.dedupKey(targeting);
    this.currentKeyAtMs = Date.now();
    this.loadedAd = null;
    this.state = 'loading';
    void this.doLoadFlow(targeting, generation);
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
          // Prefetch the post-close fallback screens while the ad is on screen
          // (native parity) — the close handoff is then synchronous, with no
          // fetch-after-close flash.
          this.prefetchFallbacks(ad);
        },
        onImpression: () => {
          this.emit(SimulaAdEventType.IMPRESSION);
          const adValue = adValueFromBidCpm(creative.bidAmt);
          this.emit(SimulaAdEventType.PAID, { adValue });
          Telemetry.recordLifecycle('impression', { adFormat: this.adFormat, adUnitId: this.adUnitId, adId: creative.impressionId });
          Telemetry.recordLifecycle('paid', { adFormat: this.adFormat, adUnitId: this.adUnitId, adId: creative.impressionId });
          this.onBillableImpression(ad);
        },
        onCtaClick: (url, handled) => this.handleCtaClick(ad, url, handled),
        onClose: (elapsedSeconds) => {
          // Post-close fallback screens (Kotlin/Swift parity): the backend may
          // serve end screens for this impression — CLOSED fires only after
          // the last one (or immediately when there are none). A teardown
          // (destroy / preview) completes the close flow synchronously — no
          // fallback fetch while the host is tearing down.
          this.pendingClose = { ad, elapsedSeconds };
          if (ad.creative.impressionId === 'preview' || this.destroyed) {
            this.finishClose();
            return;
          }
          void this.startFallbackFlow(ad, elapsedSeconds);
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

  /** Shared CTA handling for the primary ad and fallback screens. */
  private handleCtaClick(ad: LoadedAd, url?: string, handled?: boolean): void {
    this.emit(SimulaAdEventType.CLICKED);
    Telemetry.recordLifecycle('click', { adFormat: this.adFormat, adUnitId: this.adUnitId, adId: ad.creative.impressionId });
    if (handled) return; // the creative navigated itself — never double-open
    const target = url ?? ad.creative.trackingUrl ?? ad.creative.storeUrl;
    if (target) {
      try {
        window.open(target, '_blank', 'noopener');
      } catch {
        // Popup blocked — the click event already fired
      }
    }
  }

  // ── Post-close fallback screens (Kotlin/Swift parity) ────────────────────

  /** Kick off the fallback prefetch while the primary ad shows (fire-and-forget). */
  private prefetchFallbacks(ad: LoadedAd): void {
    const impressionId = ad.creative.impressionId;
    if (!impressionId || impressionId === 'preview') return;
    if (this.fallbackPrefetch?.impressionId === impressionId) return; // already in flight
    this.fallbackPrefetch = {
      impressionId,
      promise: fetchFallbackAds(impressionId).catch(() => [] as FallbackAdScreen[]),
    };
  }

  /** Consume the prefetched screens (or fetch when no prefetch ran) and present them in reveal order. */
  private async startFallbackFlow(ad: LoadedAd, elapsedSeconds: number): Promise<void> {
    const prefetch = this.fallbackPrefetch;
    this.fallbackPrefetch = null;
    // The prefetch is usually already resolved by close time; awaiting an
    // in-flight one is still far faster than a cold fetch.
    const source =
      prefetch && prefetch.impressionId === ad.creative.impressionId
        ? prefetch.promise
        : fetchFallbackAds(ad.creative.impressionId).catch(() => [] as FallbackAdScreen[]);
    const screens = await raceWithTimeout(source, FALLBACK_WAIT_CAP_MS, [] as FallbackAdScreen[]);
    if (this.destroyed || screens.length === 0) {
      this.finishClose();
      return;
    }
    this.presentFallbackScreen(ad, screens, 0, elapsedSeconds);
  }

  /**
   * Presents fallback screens one per close, in reveal order (campaign
   * creative, then the end screen). Each screen index maps to an
   * `auto_store_redirect` trigger (Kotlin `endScreenTriggerForIndex`):
   * 0 → end_screen_1_open, 1 → end_screen_2_open.
   */
  private presentFallbackScreen(ad: LoadedAd, screens: FallbackAdScreen[], index: number, elapsedSeconds: number): void {
    // Never hijack a newer presentation: if another fullscreen ad/preview took
    // over while this flow was waiting, complete the close without fallbacks.
    if (this.destroyed || index >= screens.length || isFullscreenActive()) {
      this.finishClose();
      return;
    }
    const screen = screens[index];
    const trigger = index === 0 ? 'end_screen_1_open' : index === 1 ? 'end_screen_2_open' : null;
    const fallbackCreative: LoadedCreative = {
      impressionId: screen.adId ?? ad.creative.impressionId,
      renderedHtml: screen.html,
      iframeUrl: screen.iframeUrl,
      destination: ad.creative.destination,
      trackingUrl: ad.creative.trackingUrl,
      storeUrl: ad.creative.storeUrl,
      bidAmt: 0,
      adBehavior: null, // close chrome comes from FALLBACK_CLOSE_BEHAVIOR below
    };
    const handle = presentFullscreenAd({
      creative: fallbackCreative,
      adUnitType: this.adUnitType,
      // Kotlin parity: 5s countdown ring (foreground-gated) → close button
      closeBehavior: { ...FALLBACK_CLOSE_BEHAVIOR },
      handlers: {
        onDisplayed: () => {
          if (trigger) this.onCreativeMoment(ad, trigger);
        },
        onImpression: () => {}, // fallback screens don't bill the SDK-side impression
        onCtaClick: (url) => this.handleCtaClick(ad, url),
        // Deferred one microtask: when this close came from a TAKEOVER (a new
        // presentation force-closing us), the mutex is transiently free while
        // the takeover is mid-mount — advancing synchronously would mount a
        // re-entrant overlay. After the microtask the takeover holds the mutex
        // and the guard above bails to finishClose. A user close advances
        // before the next paint — no flash between screens.
        onClose: () => {
          void Promise.resolve().then(() => this.presentFallbackScreen(ad, screens, index + 1, elapsedSeconds));
        },
      },
    });
    if (!handle) {
      this.finishClose();
      return;
    }
    this.presenter = handle; // destroy() tears down the current screen
  }

  /**
   * The full close flow completes: primary ad + every fallback screen.
   * Consumes pendingClose exactly once — late async completions (a fallback
   * fetch landing after destroy() already finished the flow) are no-ops.
   */
  private finishClose(): void {
    const pending = this.pendingClose;
    if (!pending) return;
    this.pendingClose = null;
    const { ad, elapsedSeconds } = pending;
    this.presenter = null;
    this.loadedAd = null;
    if (this.state === 'showing') this.state = 'idle';
    this.emit(SimulaAdEventType.CLOSED);
    Telemetry.recordLifecycle('closed', { adFormat: this.adFormat, adUnitId: this.adUnitId, adId: ad.creative.impressionId, durationMs: elapsedSeconds * 1000 });
    this.onAdClosed(ad, elapsedSeconds);
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
