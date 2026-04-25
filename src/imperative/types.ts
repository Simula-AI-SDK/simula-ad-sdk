import type { Message } from '../types';

/**
 * PRD-grounded event catalog for the imperative ad API.
 * Shared events fire for both interstitial and rewarded managers; the last
 * two events are rewarded-only.
 */
export type SimulaEventType =
  | 'LOADED'
  | 'LOAD_FAILED'
  | 'DISPLAYED'
  | 'DISPLAY_FAILED'
  | 'CLICKED'
  | 'CLOSED'
  | 'EARNED_REWARD'
  | 'REWARD_VERIFICATION_FAILED';

/**
 * Base init config fields shared by all imperative managers.
 * Mirrors the PRD's top-level init options.
 */
export interface ImperativeInitConfigBase {
  /** Simula API key. Required. */
  apiKey: string;
  /** Optional ad unit identifier (reserved for future backend routing). */
  adUnitId?: string;
  /** Optional publisher-provided user id (PPID). Suppressed when consent is false. */
  primaryUserID?: string;
  /** Privacy consent flag; defaults to true. */
  hasPrivacyConsent?: boolean;
  /** Dev-mode flag forwarded to SimulaProvider. */
  devMode?: boolean;
  /**
   * Minimum play-time threshold in seconds. Default 15.
   * Clamped to [10, 30] at construction time.
   */
  minPlayThreshold?: number;
}

/** Interstitial-only init config. `delegateChar` is not exposed on rewarded. */
export interface InterstitialInitConfig extends ImperativeInitConfigBase {
  /** Whether Simula should render the AI character inside the minigame iframe. Default: true. */
  delegateChar?: boolean;
}

/** Rewarded-only init config. */
export interface RewardedInitConfig extends ImperativeInitConfigBase {}

/**
 * Per-show parameters for both manager classes.
 * All character data travels on `.show()`, never `.init()`.
 */
export interface ImperativeShowParams {
  charID: string;
  charName: string;
  charImage: string;
  charDesc?: string;
  messages?: Message[];
}

/** Handler signature for `addAdEventListener`. Payload shape is event-specific. */
export type SimulaEventHandler = (payload: unknown) => void;

/** Return value of `addAdEventListener`; call `.remove()` to unsubscribe. */
export interface SimulaAdEventSubscription {
  remove: () => void;
}
