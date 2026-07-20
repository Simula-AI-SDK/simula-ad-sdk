import { NativeContext } from '../types';
import { logger, setDebugMode } from '../utils/logger';
import { validateNativeContext } from '../utils/validation';
import { checkFrequencyCapStatus } from '../utils/api';
import { SessionManager } from './session';
import { SimulaStorage } from './storage';
import {
  SimulaPrivacy,
  SimulaPrivacyConfig,
  allowsPrimaryUserID,
} from '../privacy/SimulaPrivacy';
import { primeConnectionType } from './connectionType';
import { primeDeviceSignals } from './deviceSignals';
import { Telemetry } from '../telemetry/telemetry';
import { BeaconQueue } from './beaconQueue';
import { fireIpv4Beacon, onIpv4Logout, IPV4_REASON_INIT, IPV4_REASON_PPID_UPDATE } from './ipv4Beacon';
import { RewardVerificationQueue } from '../ads/rewardVerificationQueue';
import { loadNativeAd } from '../utils/api';
import { generateId } from '../utils/id';
import {
  preloadCapacityAvailable,
  storePreloadedAd,
  destroyPreloadedAd as removePreloadedAd,
} from '../nativeAd/preloadCache';
import { invalidateNativeAd as invalidateNativeAdEntry, invalidateAllNativeAds } from '../nativeAd/nativeAdCache';
import { resolveNativeAdTheme, SimulaNativeAdTheme } from '../nativeAd/theme';

export interface SimulaInitConfig {
  apiKey: string;
  devMode?: boolean;
  primaryUserID?: string;
  /**
   * Legacy coarse consent flag. When false, suppresses PII (primaryUserID).
   * Defaults to true. `privacy` takes precedence when both are supplied.
   */
  hasPrivacyConsent?: boolean;
  /** Granular consent config (GDPR/TCF/CCPA/GPP/COPPA) — takes precedence over `hasPrivacyConsent`. */
  privacy?: SimulaPrivacyConfig;
  /** Opt out of SDK telemetry. Defaults to true (telemetry enabled). */
  telemetryEnabled?: boolean;
  adContext?: NativeContext;
}

/**
 * SimulaAds — imperative entry point (mirrors `SimulaAds` in the Kotlin and
 * Swift SDKs). `<SimulaProvider>` delegates here; both paths are
 * behavior-identical.
 *
 * Prime directive (shared with the native SDKs): never crash the host page.
 * Every method degrades to a no-op / safe default instead of throwing.
 */

let initialized = false;
let apiKey = '';
let devMode = false;
let primaryUserID: string | undefined;
let adContext: NativeContext | null = null;

/** The forwardable PPID under the CURRENT resolved consent snapshot (live read — COPPA/consent gated). */
function effectiveUserID(): string | undefined {
  return allowsPrimaryUserID(SimulaPrivacy.current) ? primaryUserID : undefined;
}

/** Local calendar day stamp — frequency-cap results are attributed to the day the check started. */
function localDayStamp(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function initialize(config: SimulaInitConfig): boolean {
  try {
    if (initialized) {
      logger.debug('SimulaAds.initialize: already initialized (first valid call wins)');
      return false;
    }
    const key = config && config.apiKey;
    if (!key || typeof key !== 'string' || !key.trim()) {
      logger.error('SimulaAds.initialize requires a non-empty "apiKey" (get one from the Simula dashboard)');
      return false;
    }
    // The validator logs the reason on failure; an invalid context is ignored, not fatal.
    const initContext =
      config.adContext != null && validateNativeContext(config.adContext, false)
        ? config.adContext
        : null;

    apiKey = key;
    devMode = config.devMode === true;
    primaryUserID =
      typeof config.primaryUserID === 'string' && config.primaryUserID.trim()
        ? config.primaryUserID
        : undefined;
    adContext = initContext;
    initialized = true;

    setDebugMode(devMode);

    // ── Privacy (attach CMP auto-read, apply explicit config — the granular
    // `privacy` object takes precedence over the legacy flag, native parity) ──
    SimulaPrivacy.attach();
    SimulaPrivacy.apply({
      hasPrivacyConsent: config.hasPrivacyConsent !== false,
      ...config.privacy,
    });

    // ── Signals (off critical path, TTL-cached, zero per-request cost) ──
    primeConnectionType();
    primeDeviceSignals();

    // ── Session ──
    SessionManager.configure(apiKey, devMode, effectiveUserID(), {
      onSessionInstalled: (sessionId, ppid) => {
        Telemetry.recordOperation('session_created', { success: true });
        fireIpv4Beacon(apiKey, sessionId, ppid, IPV4_REASON_INIT);
      },
      onPpidReconciled: (ppid) => {
        // The PATCH landed — the sid genuinely represents the new ppid server-side
        fireIpv4Beacon(apiKey, SessionManager.getSessionId(), ppid, IPV4_REASON_PPID_UPDATE);
      },
      onLogout: () => {
        onIpv4Logout();
      },
      onTelemetryDirective: (directive) => {
        Telemetry.applyServerDirective(directive.telemetryEnabled, directive.telemetrySampleRate);
      },
    });

    // ── Telemetry ──
    Telemetry.install({
      apiKey,
      devMode,
      enabled: config.telemetryEnabled !== false,
      identity: () => ({ ppid: effectiveUserID() }),
    });

    // ── Consent changes: re-gate PII, then re-create the session with fresh
    // privacy signals (SimulaPrivacy already debounces 300ms — native parity) ──
    SimulaPrivacy.subscribe(() => {
      SessionManager.resync(effectiveUserID());
    });

    // ── Recover durable queues from a previous page load ──
    BeaconQueue.triggerProcessQueue();
    RewardVerificationQueue.triggerProcessQueue();

    // Warm the session off the critical path — never awaited, never throws.
    void SessionManager.ensureSession();
    return true;
  } catch (error) {
    logger.error('SimulaAds.initialize failed:', error);
    return false;
  }
}

function isInitialized(): boolean {
  return initialized;
}

function getSessionId(): string | undefined {
  return SessionManager.getSessionId();
}

/** Full-replace targeting context (mirrors native `updateContext`). */
function updateContext(context: NativeContext | null): void {
  if (!initialized) return;
  if (context != null && !validateNativeContext(context, false)) return; // logs, keeps prior context
  adContext = context;
}

function getContext(): NativeContext | null {
  return adContext;
}

/**
 * Mid-session login/logout. A null/blank id clears the PPID (logout):
 * local-only — the backend PATCH path can't express an empty id, and the
 * live session identity is treated as stale from then on (native parity).
 */
function updatePrimaryUserID(id: string | null): void {
  if (!initialized) return;
  primaryUserID = typeof id === 'string' && id.trim() ? id : undefined;
  SessionManager.updatePrimaryUserID(primaryUserID ?? null, allowsPrimaryUserID(SimulaPrivacy.current));
}

/**
 * Checks whether the user has hit the frequency cap for [adUnitId] — a
 * read-only check that records no impression. Returns `true` when capped
 * (skip the surface). Fails open: uninitialized, blank adUnitId, or any
 * network/server failure resolves to `false` so a hiccup can never hide an
 * ad surface that would otherwise have served. A `true` result is cached
 * for the rest of the local day (reset at local midnight) — native parity.
 */
async function checkFrequencyCap(adUnitId: string, userID?: string | null): Promise<boolean> {
  if (!initialized || !adUnitId || !adUnitId.trim()) return false;
  try {
    const ppid = userID && userID.trim() ? userID : effectiveUserID();
    const cacheKey = `freqcap:${localDayStamp()}`;
    const cacheId = `${adUnitId}|${ppid ?? ''}`;

    const cached = SimulaStorage.getJSON<Record<string, boolean>>(cacheKey);
    if (cached && cached[cacheId] === true) return true;

    // Attach the session id only when it represents the same identity we're
    // checking — a stale session id could make the backend evaluate the cap
    // for the wrong user (mirrors Kotlin `consistentSessionId`).
    const sessionId =
      SessionManager.getSessionUserID() === ppid ? SessionManager.getSessionId() : undefined;

    const capped = await checkFrequencyCapStatus(apiKey, adUnitId, ppid, sessionId);
    if (capped) {
      SimulaStorage.setJSON(cacheKey, { ...(cached ?? {}), [cacheId]: true });
    }
    return capped;
  } catch {
    return false;
  }
}

/**
 * Options for `SimulaAds.preloadNativeAd` (native parity).
 */
export interface PreloadNativeAdOptions {
  adUnitId?: string;
  position?: number;
  theme?: SimulaNativeAdTheme;
}

/**
 * Preloads a native ad for instant rendering (native parity). Holds at most 5
 * preloaded ads; each is consumed once via `<NativeBanner preloadedAdId>`.
 * Returns the `preloadedAdId`, or null when uninitialized / capped / no-fill.
 * Fails open: a preload failure never throws — the slot simply live-loads.
 */
async function preloadNativeAd(options: PreloadNativeAdOptions = {}): Promise<string | null> {
  if (!initialized) return null;
  try {
    if (!preloadCapacityAvailable()) {
      Telemetry.recordOperation('native_preload_capped', { success: false });
      return null;
    }
    const sessionId = await SessionManager.ensureSession();
    if (!sessionId) return null;
    const position = options.position ?? 0;
    const theme = resolveNativeAdTheme(options.theme ?? null);
    const result = await loadNativeAd({
      apiKey,
      position,
      sessionId,
      adUnitId: options.adUnitId,
      context: adContext,
      theme,
    });
    if (!result.creative) return null;
    const preloadedAdId = generateId();
    storePreloadedAd({ preloadedAdId, creative: result.creative, adUnitId: options.adUnitId, position, theme });
    Telemetry.recordLifecycle('load_success', {
      adFormat: 'native',
      adUnitId: options.adUnitId,
      adId: result.creative.impressionId,
      cacheSource: 'preload',
    });
    return preloadedAdId;
  } catch {
    return null;
  }
}

/** Destroys a preloaded native ad that won't be used (native parity). */
function destroyPreloadedAd(preloadedAdId: string): void {
  if (!initialized || !preloadedAdId) return;
  removePreloadedAd(preloadedAdId);
}

/** Invalidates the cached ad for one (adUnitId, position) slot — the next render re-fetches. */
function invalidateNativeAd(options: { adUnitId?: string; position?: number } = {}): void {
  if (!initialized) return;
  invalidateNativeAdEntry(options.adUnitId, options.position ?? 0);
}

/** Invalidates every cached native ad. */
function invalidateNativeAds(): void {
  if (!initialized) return;
  invalidateAllNativeAds();
}

/**
 * Keeps runtime identity props in sync (used by `<SimulaProvider>` when
 * `primaryUserID` / `hasPrivacyConsent` change after mount).
 * @internal
 */
function _syncIdentity(userID: string | undefined, legacyConsentFlag: boolean): void {
  if (!initialized) return;
  primaryUserID = typeof userID === 'string' && userID.trim() ? userID : undefined;
  SimulaPrivacy.update({ hasPrivacyConsent: legacyConsentFlag });
  SessionManager.updatePrimaryUserID(primaryUserID ?? null, allowsPrimaryUserID(SimulaPrivacy.current));
}

/** Test hook. Not public API. */
function _resetForTests(): void {
  initialized = false;
  apiKey = '';
  devMode = false;
  primaryUserID = undefined;
  adContext = null;
}

/** Internal accessor for SDK layers (ads/telemetry) that must sign requests. @internal */
function _getApiKey(): string {
  return apiKey;
}

export const SimulaAds = {
  initialize,
  isInitialized,
  getSessionId,
  updateContext,
  getContext,
  updatePrimaryUserID,
  checkFrequencyCap,
  preloadNativeAd,
  destroyPreloadedAd,
  invalidateNativeAd,
  invalidateNativeAds,
  _syncIdentity,
  _resetForTests,
  _getApiKey,
};
