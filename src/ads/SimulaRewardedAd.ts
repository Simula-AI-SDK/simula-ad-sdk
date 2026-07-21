import { SimulaAds } from '../core/SimulaAds';
import { loadRewardedAd, LoadedCreative } from '../utils/api';
import { Telemetry } from '../telemetry/telemetry';
import { SimulaAdError } from './errors';
import { SimulaBaseAd, SimulaAdLoadOptions } from './SimulaBaseAd';
import { SimulaRewardedAdEventType } from './events';
import { CloseBehavior, validatedHexColor, MAX_CLOSE_DELAY_SECONDS, AdUnitType } from './adBehavior';
import { presentFullscreenAd, FullscreenPresenterHandle } from './fullscreenPresenter';
import { RewardVerificationQueue } from './rewardVerificationQueue';
import { SimulaAdEventType } from './events';

/** QA/debug preview options (native parity: SimulaRewardedAd.showPreview). No network, no impression. */
export interface RewardedPreviewOptions {
  durationSeconds?: number;
}

const PREVIEW_HTML = `<!DOCTYPE html><html><body style="margin:0;background:#0e2a1a;color:#fff;font:16px sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;gap:8px"><div style="font-size:22px;font-weight:600">Simula Rewarded Preview</div><div style="opacity:0.7">QA preview — no network, no impression</div></body></html>`;

/**
 * Imperative play-to-earn rewarded ad (native parity: `SimulaRewardedAd`).
 *
 * The full interstitial event set plus:
 * - `EARNED_REWARD` — the server-driven gate (`ad_behavior.close.delay_seconds`)
 *   elapsed client-side; the publisher may grant an in-app reward optimistically
 * - `REWARD_VERIFIED(token)` — the durable server-side verification (SSV)
 *   succeeded; the token is the publisher's idempotency key for granting
 * - `REWARD_VERIFICATION_FAILED(error)` — verification permanently failed
 *
 * Verification is enqueued in a durable, idempotent queue (HTTP 409 → success,
 * 5s→60s backoff, survives page reload) — a reward is never silently lost.
 */
export class SimulaRewardedAd extends SimulaBaseAd {
  protected readonly adFormat = 'rewarded' as const;
  protected readonly adUnitType: AdUnitType = 'rewarded';

  /** Impressions whose reward gate elapsed (the only ones worth verifying). */
  private earnedImpressionIds = new Set<string>();

  constructor(adUnitId: string) {
    super(adUnitId);
  }

  protected async fetchCreative(
    sessionId: string,
    targeting: SimulaAdLoadOptions,
  ): Promise<{ creative?: LoadedCreative; error?: SimulaAdError }> {
    return loadRewardedAd({
      apiKey: SimulaAds._getApiKey(),
      adUnitId: this.adUnitId,
      sessionId,
      targeting,
      context: SimulaAds.getContext(),
    });
  }

  /** The client-side reward gate elapsed (native parity: onAdEarnedReward). */
  protected onRewardGateElapsed(ad: { creative: LoadedCreative }): void {
    this.earnedImpressionIds.add(ad.creative.impressionId);
    this.emit(SimulaRewardedAdEventType.EARNED_REWARD);
    Telemetry.recordLifecycle('reward_earned', {
      adFormat: this.adFormat,
      adUnitId: this.adUnitId,
      adId: ad.creative.impressionId,
    });
  }

  /**
   * On close: verify ONLY when the reward gate elapsed (Kotlin parity:
   * `onRewardCompleted` returns early when `!earned`) — a pre-gate close
   * grants nothing, so it must not POST a wasted verification nor surface a
   * spurious REWARD_VERIFICATION_FAILED. Then auto-preload the next ad.
   */
  protected onAdClosed(
    ad: { creative: LoadedCreative; sessionId: string },
    elapsedSeconds: number,
  ): void {
    const earned = this.earnedImpressionIds.delete(ad.creative.impressionId);
    if (earned) {
      RewardVerificationQueue.enqueue(
        {
          serveId: ad.creative.impressionId,
          sessionId: ad.sessionId,
          elapsedPlayTime: elapsedSeconds,
          adUnitId: this.adUnitId,
        },
        {
          onVerified: (token) => {
            this.emit(SimulaRewardedAdEventType.REWARD_VERIFIED, { rewardToken: token });
            Telemetry.recordLifecycle('reward_verified', {
              adFormat: this.adFormat,
              adUnitId: this.adUnitId,
              adId: ad.creative.impressionId,
            });
          },
          onFailed: (error) => {
            this.emit(SimulaRewardedAdEventType.REWARD_VERIFICATION_FAILED, {
              error: SimulaAdError.network(error),
            });
            Telemetry.recordLifecycle('reward_verification_failed', {
              adFormat: this.adFormat,
              adUnitId: this.adUnitId,
              adId: ad.creative.impressionId,
              errorCode: 'network',
            });
          },
        },
      );
    }
    // Auto-preload the next ad on close (native parity)
    this.preloadNext();
  }

  /**
   * QA/debug preview of the reward gate chrome — no network, no impression
   * (native parity: showPreview).
   */
  showPreview(options: RewardedPreviewOptions = {}): FullscreenPresenterHandle | null {
    const durationSeconds = options.durationSeconds ?? 8;
    const behavior: CloseBehavior = {
      delaySeconds: Math.min(Math.max(Math.round(durationSeconds), 0), MAX_CLOSE_DELAY_SECONDS),
      treatment: 'reward_or_close_label',
      position: 'top_right',
      progressBarColor: validatedHexColor('#FFFFFF'),
    };
    return presentFullscreenAd({
      creative: { impressionId: 'preview', renderedHtml: PREVIEW_HTML, destination: 'web', bidAmt: 0, adBehavior: { close: behavior, storeOpen: 'external' } },
      adUnitType: 'rewarded',
      closeBehavior: behavior,
      handlers: {
        onDisplayed: () => this.emit(SimulaAdEventType.DISPLAYED),
        onImpression: () => {}, // preview never bills
        onCtaClick: () => {},
        onRewardGateElapsed: () => this.emit(SimulaRewardedAdEventType.EARNED_REWARD),
        onClose: () => this.emit(SimulaAdEventType.CLOSED),
      },
    });
  }
}

export type { SimulaAdLoadOptions };
