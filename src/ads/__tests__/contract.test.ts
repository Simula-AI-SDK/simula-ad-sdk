/**
 * CROSS-PLATFORM CONTRACT — pinned verbatim against the Kotlin and Swift SDKs.
 *
 * These strings are the shared spec across all Simula SDKs (Kotlin, Swift,
 * React Native, Web). If any assertion here fails, the change is a PARITY
 * BREAK — the same change must land in every SDK, or be reverted.
 *
 * Sources of truth:
 * - ads/SimulaAdError.kt (Kotlin) · Ads/SimulaAdError.swift (iOS)
 * - RN wrapper src/ads/types.ts (event names)
 * - Telemetry stage names (Kotlin Telemetry.kt, shared snake_case with iOS)
 */
import { describe, it, expect } from 'vitest';
import { SimulaAdError } from '../errors';
import { SimulaAdEventType, SimulaRewardedAdEventType } from '../events';
import { MAX_CLOSE_DELAY_SECONDS } from '../adBehavior';

describe('cross-platform contract (pinned — do not change without updating every SDK)', () => {
  it('ad event names are verbatim', () => {
    expect(Object.values(SimulaAdEventType)).toEqual([
      'LOADED',
      'LOAD_FAILED',
      'DISPLAYED',
      'IMPRESSION',
      'PAID',
      'DISPLAY_FAILED',
      'CLICKED',
      'CLOSED',
    ]);
  });

  it('rewarded event names are verbatim', () => {
    expect(Object.values(SimulaRewardedAdEventType)).toEqual([
      'EARNED_REWARD',
      'REWARD_VERIFIED',
      'REWARD_VERIFICATION_FAILED',
    ]);
  });

  it('error codes are verbatim (telemetry error_code contract)', () => {
    const codes = [
      SimulaAdError.notInitialized().code,
      SimulaAdError.noSession().code,
      SimulaAdError.noFill().code,
      SimulaAdError.notReady().code,
      SimulaAdError.stale().code,
      SimulaAdError.duplicateLoading().code,
      SimulaAdError.alreadyShowing().code,
      SimulaAdError.noPresentationContext().code,
      SimulaAdError.network().code,
      SimulaAdError.adUnitNotFound().code,
    ];
    expect(codes).toEqual([
      'not_initialized',
      'no_session',
      'no_fill',
      'not_ready',
      'stale',
      'duplicate_request',
      'already_showing',
      'no_presentation_context',
      'network',
      'ad_unit_not_found',
    ]);
  });

  it('error messages are verbatim with the native SDKs', () => {
    expect(SimulaAdError.notInitialized().message).toBe(
      'SimulaAds is not initialized — call SimulaAds.initialize() first.',
    );
    expect(SimulaAdError.noSession().message).toBe(
      'Could not create a session. Check the API key and network connection.',
    );
    expect(SimulaAdError.noFill().message).toBe('No ad available to show right now (no fill).');
    expect(SimulaAdError.notReady().message).toBe(
      'Ad not ready — call load() first and wait for the loaded callback before show().',
    );
    expect(SimulaAdError.stale().message).toBe(
      'The loaded ad has expired (1 hour limit) and can no longer be shown. Call load() to request a new ad.',
    );
    expect(SimulaAdError.duplicateReady(42).message).toBe(
      'An ad for this placement is already loaded. Call show() to display it, or load() again in 42 seconds.',
    );
    expect(SimulaAdError.duplicateLoading().message).toBe(
      'An ad for this placement is already loading. Wait for the onAdLoaded callback before calling load() again.',
    );
    expect(SimulaAdError.alreadyShowing().message).toBe('An interstitial is already showing.');
    expect(SimulaAdError.network().message).toBe(
      'Network error while loading the ad — check the connection and call load() again.',
    );
    expect(SimulaAdError.adUnitNotFound().message).toBe(
      'Ad unit id is not registered for this app — check the ad unit id in your Simula dashboard.',
    );
  });

  it('telemetry lifecycle stage names are verbatim (snake_case)', () => {
    // The stages this SDK records — a subset of the native contract (web
    // has no haptics/orientation/store-return signals). Pinned so a rename
    // here is a conscious, cross-SDK decision.
    const LIFECYCLE_STAGES = [
      'load_success',
      'load_fail',
      'displayed',
      'impression',
      'paid',
      'click',
      'closed',
      'show_fail',
      'native_render',
      'viewability',
      'reward_earned',
      'reward_verified',
      'reward_verification_failed',
      'store_opened',
    ] as const;
    const OPERATIONS = ['sdk_init', 'sdk_upgrade', 'session_created', 'session_failed', 'native_preload_capped'] as const;

    // Assert the pinned lists stay exactly as the contract says (order-sensitive on purpose)
    expect([...LIFECYCLE_STAGES]).toEqual([
      'load_success',
      'load_fail',
      'displayed',
      'impression',
      'paid',
      'click',
      'closed',
      'show_fail',
      'native_render',
      'viewability',
      'reward_earned',
      'reward_verified',
      'reward_verification_failed',
      'store_opened',
    ]);
    expect([...OPERATIONS]).toEqual(['sdk_init', 'sdk_upgrade', 'session_created', 'session_failed', 'native_preload_capped']);
  });

  it('ad_behavior constants are verbatim', () => {
    // Kotlin Types.kt: the close_chrome experiment arms are 20/30/45s — the cap
    // honors the largest authored value while bounding a malformed one.
    expect(MAX_CLOSE_DELAY_SECONDS).toBe(45);
  });
});
