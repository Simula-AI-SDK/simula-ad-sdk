/**
 * Shared utilities for imperative manager classes.
 */

import type { GameData, MinigameResponse, InitRewardedResponse } from '../types';

export const DEFAULT_MIN_PLAY_THRESHOLD = 15;
export const MIN_PLAY_THRESHOLD_LOWER = 10;
export const MIN_PLAY_THRESHOLD_UPPER = 30;

/**
 * Clamps `minPlayThreshold` to [10, 30] and defaults to 15 when missing or
 * non-numeric. Shared by SimulaMiniGameInterstitial and SimulaRewardedMiniGame.
 */
export function clampMinPlayThreshold(value: number | undefined): number {
  const raw =
    typeof value === 'number' && !Number.isNaN(value)
      ? value
      : DEFAULT_MIN_PLAY_THRESHOLD;
  return Math.max(
    MIN_PLAY_THRESHOLD_LOWER,
    Math.min(MIN_PLAY_THRESHOLD_UPPER, Math.round(raw)),
  );
}

/**
 * Explicit marker for "ad preload settled with no fallback ad".
 * Used when preload decides there is no fallback-ad iframe to prefetch but
 * the show-path is still known (e.g. devMode placeholder, or no aditude
 * configured). This is distinct from `null`, which means "preload has not
 * run / not resolved yet".
 */
export type FallbackAdPreload =
  | { kind: 'iframe'; iframeUrl: string }
  | { kind: 'none' };

/**
 * Cached payload for a single interstitial preload cycle. All fields populated
 * before LOADED fires; cleared on LOAD_FAILED, dispose, and after the cached
 * show consumes it.
 */
export interface InterstitialPreloadCache {
  /** Full catalog fetch result — retained so MiniGameMenu can reuse without re-fetching. */
  catalog: GameData[];
  /** Menu id for downstream trackMenuGameClick calls. */
  menuId: string | null;
  /** Deterministically selected sponsored game. */
  selectedGame: GameData;
  /** Bootstrap response from getMinigame() for the selected game. */
  minigame: MinigameResponse;
  /** Prefetched fallback-ad iframe URL, or explicit 'none' marker. */
  fallbackAd: FallbackAdPreload;
}

/**
 * Cached payload for a single rewarded preload cycle.
 */
export interface RewardedPreloadCache {
  rewarded: InitRewardedResponse;
  fallbackAd: FallbackAdPreload;
}

/**
 * Deterministic sponsored-game selection. Today's rule: pick the first entry
 * in the catalog. Keeping this in a named helper so callers can't silently
 * rely on a different ordering later.
 */
export function selectSponsoredGame(games: GameData[] | null | undefined): GameData | null {
  if (!games || games.length === 0) return null;
  return games[0];
}

/**
 * Normalize a fallback-ad prefetch result into the FallbackAdPreload shape.
 * The API helper returns `string | null` — `null` means "no ad available",
 * which we represent explicitly as `{ kind: 'none' }` so preload can settle
 * cleanly without falsely emitting LOAD_FAILED.
 */
export function normalizeFallbackAd(iframeUrl: string | null | undefined): FallbackAdPreload {
  if (typeof iframeUrl === 'string' && iframeUrl.length > 0) {
    return { kind: 'iframe', iframeUrl };
  }
  return { kind: 'none' };
}
