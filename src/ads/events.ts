import { AdValue } from '../core/adValue';
import { SimulaAdError } from './errors';

/**
 * Ad lifecycle event taxonomy — exact cross-platform contract shared with the
 * Kotlin, Swift, and React Native SDKs.
 *
 * Three-signal model: DISPLAYED = shown signal; IMPRESSION = billable (~2s
 * after render for full-screen, viewability for native); PAID = estimated
 * revenue (AdValue), co-fired with IMPRESSION.
 */
export const SimulaAdEventType = {
  LOADED: 'LOADED',
  LOAD_FAILED: 'LOAD_FAILED',
  DISPLAYED: 'DISPLAYED',
  IMPRESSION: 'IMPRESSION',
  PAID: 'PAID',
  DISPLAY_FAILED: 'DISPLAY_FAILED',
  CLICKED: 'CLICKED',
  CLOSED: 'CLOSED',
} as const;
export type SimulaAdEventType = (typeof SimulaAdEventType)[keyof typeof SimulaAdEventType];

/** Rewarded-only events. */
export const SimulaRewardedAdEventType = {
  EARNED_REWARD: 'EARNED_REWARD',
  REWARD_VERIFIED: 'REWARD_VERIFIED',
  REWARD_VERIFICATION_FAILED: 'REWARD_VERIFICATION_FAILED',
} as const;
export type SimulaRewardedAdEventType = (typeof SimulaRewardedAdEventType)[keyof typeof SimulaRewardedAdEventType];

export type AnyAdEventType = SimulaAdEventType | SimulaRewardedAdEventType;

/** The event payload delivered to ad listeners (mirrors the RN wrapper's `SimulaAdEvent`). */
export interface SimulaAdEvent {
  type: AnyAdEventType;
  error?: SimulaAdError;
  adValue?: AdValue;
  /** SSV reward token (REWARD_VERIFIED only). */
  rewardToken?: string;
}

export type SimulaAdEventListener = (event: SimulaAdEvent) => void;
export type SimulaTypedAdEventListener = (event: Omit<SimulaAdEvent, 'type'>) => void;
export type SimulaUnsubscribe = () => void;
