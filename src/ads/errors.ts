/**
 * Failure cases for the imperative ad APIs — mirrors `SimulaAdError` in the
 * Kotlin and Swift SDKs. The `code` strings are the stable cross-platform
 * contract (also used as telemetry `error_code`); `message` strings are
 * verbatim with the native SDKs.
 */

export type SimulaAdErrorCode =
  | 'not_initialized'
  | 'no_session'
  | 'no_fill'
  | 'not_ready'
  | 'stale'
  | 'duplicate_request'
  | 'already_showing'
  | 'no_presentation_context'
  | 'network'
  | 'ad_unit_not_found';

export class SimulaAdError extends Error {
  readonly code: SimulaAdErrorCode;
  /** Present only on `duplicate_request` when the matching ad is ready: seconds left in the dedup window. */
  readonly retryInSeconds?: number;
  readonly cause?: unknown;

  constructor(code: SimulaAdErrorCode, message: string, opts: { retryInSeconds?: number; cause?: unknown } = {}) {
    super(message);
    this.name = 'SimulaAdError';
    this.code = code;
    this.retryInSeconds = opts.retryInSeconds;
    this.cause = opts.cause;
  }

  /** `SimulaAds.initialize` was never called. */
  static notInitialized(): SimulaAdError {
    return new SimulaAdError('not_initialized', 'SimulaAds is not initialized — call SimulaAds.initialize() first.');
  }

  /** A server session could not be created (e.g. network failure). */
  static noSession(): SimulaAdError {
    return new SimulaAdError('no_session', 'Could not create a session. Check the API key and network connection.');
  }

  /** The server returned no creative to display. */
  static noFill(): SimulaAdError {
    return new SimulaAdError('no_fill', 'No ad available to show right now (no fill).');
  }

  /** `show()` was called before `load()` completed. */
  static notReady(): SimulaAdError {
    return new SimulaAdError('not_ready', 'Ad not ready — call load() first and wait for the loaded callback before show().');
  }

  /** `show()` was called on an ad that loaded more than an hour ago. Load a fresh one. */
  static stale(): SimulaAdError {
    return new SimulaAdError(
      'stale',
      'The loaded ad has expired (1 hour limit) and can no longer be shown. Call load() to request a new ad.',
    );
  }

  /** A matching ad is loaded and showable; `remainingSec` is the time left in the dedup window. */
  static duplicateReady(remainingSec: number): SimulaAdError {
    return new SimulaAdError(
      'duplicate_request',
      `An ad for this placement is already loaded. Call show() to display it, or load() again in ${remainingSec} seconds.`,
      { retryInSeconds: remainingSec },
    );
  }

  /** A matching ad's load is still in flight. */
  static duplicateLoading(): SimulaAdError {
    return new SimulaAdError(
      'duplicate_request',
      'An ad for this placement is already loading. Wait for the onAdLoaded callback before calling load() again.',
    );
  }

  /** `show()` was called while an ad is already showing. */
  static alreadyShowing(): SimulaAdError {
    return new SimulaAdError('already_showing', 'An interstitial is already showing.');
  }

  /** No presentation surface was available (e.g. show() outside a browser document). */
  static noPresentationContext(): SimulaAdError {
    return new SimulaAdError('no_presentation_context', 'No document available to present the ad.');
  }

  /** An underlying network/decoding error occurred during load. */
  static network(cause?: unknown): SimulaAdError {
    return new SimulaAdError(
      'network',
      'Network error while loading the ad — check the connection and call load() again.',
      { cause },
    );
  }

  /** The backend rejected the ad unit id — it isn't registered for this app. Non-retryable. */
  static adUnitNotFound(): SimulaAdError {
    return new SimulaAdError(
      'ad_unit_not_found',
      'Ad unit id is not registered for this app — check the ad unit id in your Simula dashboard.',
    );
  }
}

/** NativeAdError subset (native parity: `NativeAdError`). */
export type NativeAdErrorCode = 'not_initialized' | 'no_session' | 'no_fill' | 'network' | 'ad_unit_not_found';

export interface NativeAdError {
  code: NativeAdErrorCode;
  message: string;
}

export function nativeAdError(code: NativeAdErrorCode, message: string): NativeAdError {
  return { code, message };
}

/** Map an HTTP failure to a SimulaAdError, honoring the backend's structured `{code, message}` 4xx body. */
export function mapHttpError(status: number, body: any, cause?: unknown): SimulaAdError {
  if (body && typeof body === 'object' && body.code === 'ad_unit_not_found') {
    return SimulaAdError.adUnitNotFound();
  }
  if (status === 404) {
    return SimulaAdError.adUnitNotFound();
  }
  return SimulaAdError.network(cause ?? new Error(`HTTP ${status}`));
}
