import { NativeContext } from '../types';
import { logger, setDebugMode } from '../utils/logger';
import { validateNativeContext } from '../utils/validation';
import { checkFrequencyCapStatus } from '../utils/api';
import { SessionManager } from './session';
import { SimulaStorage } from './storage';

export interface SimulaInitConfig {
  apiKey: string;
  devMode?: boolean;
  primaryUserID?: string;
  /** Privacy consent flag. When false, suppresses collection of PII (primaryUserID). Defaults to true. */
  hasPrivacyConsent?: boolean;
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
let hasPrivacyConsent = true;
let adContext: NativeContext | null = null;

function effectiveUserID(): string | undefined {
  return hasPrivacyConsent ? primaryUserID : undefined;
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
    hasPrivacyConsent = config.hasPrivacyConsent !== false;
    adContext = initContext;
    initialized = true;

    setDebugMode(devMode);
    SessionManager.configure(apiKey, devMode, effectiveUserID());
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
  SessionManager.updatePrimaryUserID(primaryUserID ?? null, hasPrivacyConsent);
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
 * Keeps runtime identity props in sync (used by `<SimulaProvider>` when
 * `primaryUserID` / `hasPrivacyConsent` change after mount).
 * @internal
 */
function _syncIdentity(userID: string | undefined, consent: boolean): void {
  if (!initialized) return;
  hasPrivacyConsent = consent;
  primaryUserID = typeof userID === 'string' && userID.trim() ? userID : undefined;
  SessionManager.updatePrimaryUserID(primaryUserID ?? null, hasPrivacyConsent);
}

/** Test hook. Not public API. */
function _resetForTests(): void {
  initialized = false;
  apiKey = '';
  devMode = false;
  primaryUserID = undefined;
  hasPrivacyConsent = true;
  adContext = null;
}

export const SimulaAds = {
  initialize,
  isInitialized,
  getSessionId,
  updateContext,
  getContext,
  updatePrimaryUserID,
  checkFrequencyCap,
  _syncIdentity,
  _resetForTests,
};
