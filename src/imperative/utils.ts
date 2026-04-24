/**
 * Shared utilities for imperative manager classes.
 */

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
