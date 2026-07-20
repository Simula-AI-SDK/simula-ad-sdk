import { SimulaAds } from '../core/SimulaAds';
import { loadInterstitialAd, LoadedCreative } from '../utils/api';
import { SimulaAdError } from './errors';
import { SimulaBaseAd, SimulaAdLoadOptions } from './SimulaBaseAd';
import { CloseBehavior, closePositionFrom, closeTreatmentFrom, validatedHexColor, MAX_CLOSE_DELAY_SECONDS, AdUnitType } from './adBehavior';
import { presentFullscreenAd, FullscreenPresenterHandle } from './fullscreenPresenter';
import { SimulaAdEventType } from './events';

/** QA/debug preview options (native parity: SimulaInterstitialAd.showPreview). No network, no impression. */
export interface InterstitialPreviewOptions {
  closeTreatment: string;
  closePosition?: string;
  delaySeconds?: number;
  progressBarColor?: string;
  adUnitType?: string;
}

const PREVIEW_HTML = `<!DOCTYPE html><html><body style="margin:0;background:#1a1a2e;color:#fff;font:16px sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;gap:8px"><div style="font-size:22px;font-weight:600">Simula Ad Preview</div><div style="opacity:0.7">QA preview — no network, no impression</div></body></html>`;

/**
 * Imperative full-screen interstitial (native parity: `SimulaInterstitialAd`).
 *
 * ```ts
 * const ad = new SimulaInterstitialAd('my-ad-unit');
 * const unsub = ad.addAdEventListener(SimulaAdEventType.LOADED, () => ad.show());
 * ad.load();
 * ```
 *
 * Lifecycle: load() → LOADED/LOAD_FAILED; show() → DISPLAYED (shown),
 * IMPRESSION (billable ~2s after render) + PAID (AdValue, co-fired),
 * CLICKED (creative CTA), CLOSED. Loaded ads expire after 1 hour; same-key
 * re-loads are throttled 5 minutes; the next ad is auto-preloaded on close.
 */
export class SimulaInterstitialAd extends SimulaBaseAd {
  protected readonly adFormat = 'interstitial' as const;
  protected readonly adUnitType: AdUnitType = 'interstitial';

  constructor(adUnitId: string) {
    super(adUnitId);
  }

  protected async fetchCreative(
    sessionId: string,
    targeting: SimulaAdLoadOptions,
  ): Promise<{ creative?: LoadedCreative; error?: SimulaAdError }> {
    return loadInterstitialAd({
      apiKey: SimulaAds._getApiKey(),
      adUnitId: this.adUnitId,
      sessionId,
      targeting,
      context: SimulaAds.getContext(),
    });
  }

  /**
   * QA/debug A/B preview of the close chrome — no network, no impression,
   * no load required (native parity: showPreview).
   */
  showPreview(options: InterstitialPreviewOptions): FullscreenPresenterHandle | null {
    const behavior: CloseBehavior = {
      delaySeconds: Math.min(Math.max(Math.round(options.delaySeconds ?? 5), 0), MAX_CLOSE_DELAY_SECONDS),
      treatment: closeTreatmentFrom(options.closeTreatment),
      position: closePositionFrom(options.closePosition ?? 'top_right'),
      progressBarColor: validatedHexColor(options.progressBarColor ?? '#FFFFFF'),
    };
    return presentFullscreenAd({
      creative: { impressionId: 'preview', renderedHtml: PREVIEW_HTML, destination: 'web', bidAmt: 0, adBehavior: { close: behavior, storeOpen: 'external' } },
      adUnitType: options.adUnitType === 'rewarded' ? 'rewarded' : 'interstitial',
      closeBehavior: behavior,
      handlers: {
        onDisplayed: () => this.emit(SimulaAdEventType.DISPLAYED),
        onImpression: () => {}, // preview never bills
        onCtaClick: () => {},
        onClose: () => this.emit(SimulaAdEventType.CLOSED),
      },
    });
  }

  protected onAdClosed(): void {
    // Auto-preload the next ad on close (native parity)
    this.preloadNext();
  }
}

export type { SimulaAdLoadOptions };
