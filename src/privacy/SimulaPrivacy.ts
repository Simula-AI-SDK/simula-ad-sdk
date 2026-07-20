import { logger } from '../utils/logger';
import { SimulaStorage } from '../core/storage';
import { attachIabListeners, IabSignals } from './iab';

/**
 * Public privacy / consent configuration. Mirrors `SimulaPrivacyConfig` in the
 * Kotlin and Swift SDKs (same field names and defaults — cross-platform
 * parity contract).
 *
 * Every field defaults to a contextual, no-tracking posture. Explicit non-null
 * values take precedence over anything the SDK auto-reads from the page's IAB
 * CMP (`__tcfapi` / `__uspapi` / `__gpp`).
 */
export interface SimulaPrivacyConfig {
  /** Legacy coarse consent flag. When false, suppresses PII (the `ppid`). */
  hasPrivacyConsent?: boolean;
  /** IAB TCF v2.2 consent string (mirror of `IABTCF_TCString`). */
  tcString?: string;
  /** IAB US Privacy (CCPA) string, e.g. "1YNN" (mirror of `IABUSPrivacy_String`). */
  uspString?: string;
  /** IAB Global Privacy Platform string (mirror of `IABGPP_HDR_GppString`). */
  gppString?: string;
  /** Applicable GPP section IDs, comma-separated e.g. "2,6" (mirror of `IABGPP_GppSID`). */
  gppSid?: string;
  /** Whether GDPR applies. undefined = unknown/unset (mirror of `IABTCF_gdprApplies`). */
  gdprApplies?: boolean;
  /**
   * Explicit TCF Purpose 1 ("store/access information on a device") consent. When
   * set, takes precedence over the CMP-read value. Useful for hosts without a TCF
   * CMP and for testing storage-degradation behavior.
   */
  tcfPurpose1Consent?: boolean;
  /** COPPA (child-directed) treatment. When true, PII is suppressed. */
  coppaApplies?: boolean;
  /**
   * Present for cross-platform type parity with the native SDKs. The web SDK has
   * no advertising identifier to collect — the value is accepted and ignored.
   */
  enableAdvertisingId?: boolean;
}

/**
 * Immutable, resolved snapshot of the privacy state at a point in time
 * (explicit config merged over IAB-read values). Mirrors the native
 * `ConsentSnapshot` — same derivations, header names, and JSON keys.
 */
export interface ConsentSnapshot {
  hasPrivacyConsent: boolean;
  tcString?: string;
  uspString?: string;
  gppString?: string;
  gppSid?: string;
  gdprApplies?: boolean;
  coppaApplies: boolean;
  tcfPurpose1Consent?: boolean;
  /** Always undefined on the web (no advertising identifier exists). */
  advertisingId?: string;
}

/** Whether the host's `primaryUserID` (`ppid`) may be forwarded. */
export function allowsPrimaryUserID(s: ConsentSnapshot): boolean {
  return s.hasPrivacyConsent && !s.coppaApplies;
}

/**
 * Whether non-essential local storage is permitted. Under GDPR an *unknown*
 * Purpose 1 is treated as denied (consent must be explicit); outside GDPR we
 * permit by default (contextual). Native parity.
 */
export function allowsLocalStorage(s: ConsentSnapshot): boolean {
  if (s.gdprApplies === true) return s.tcfPurpose1Consent === true;
  return s.tcfPurpose1Consent ?? true;
}

/**
 * Consent *metadata* as request headers, merged into every ad-serving /
 * tracking call at request time. Native parity header names.
 */
export function consentHeaders(s: ConsentSnapshot): Record<string, string> {
  const h: Record<string, string> = {};
  if (s.gdprApplies !== undefined) h['X-Simula-GDPR-Applies'] = s.gdprApplies ? '1' : '0';
  if (s.tcString) h['X-Simula-Consent-TCString'] = s.tcString;
  if (s.uspString) h['X-Simula-Consent-USP'] = s.uspString;
  if (s.gppString) h['X-Simula-Consent-GPP'] = s.gppString;
  if (s.gppSid) h['X-Simula-Consent-GPP-SID'] = s.gppSid;
  if (s.tcfPurpose1Consent !== undefined) h['X-Simula-Consent-Purpose1'] = s.tcfPurpose1Consent ? '1' : '0';
  h['X-Simula-COPPA'] = s.coppaApplies ? '1' : '0';
  return h;
}

/** Consent signals as the `privacy` block embedded in the `/session/create` body. */
export function privacyJson(s: ConsentSnapshot): Record<string, unknown> {
  const j: Record<string, unknown> = {
    hasPrivacyConsent: s.hasPrivacyConsent,
    coppaApplies: s.coppaApplies,
  };
  if (s.gdprApplies !== undefined) j.gdprApplies = s.gdprApplies ? 1 : 0;
  if (s.tcString) j.tcString = s.tcString;
  if (s.uspString) j.uspString = s.uspString;
  if (s.gppString) j.gppString = s.gppString;
  if (s.gppSid) j.gppSid = s.gppSid;
  if (s.tcfPurpose1Consent !== undefined) j.tcfPurpose1Consent = s.tcfPurpose1Consent;
  return j;
}

export type PrivacyListener = (snapshot: ConsentSnapshot) => void;

const NOTIFY_DEBOUNCE_MS = 300; // native parity: CMP writes are debounced 300ms

let explicit: SimulaPrivacyConfig = {};
let iab: IabSignals = {};
let snapshot: ConsentSnapshot = resolve();
let listeners = new Set<PrivacyListener>();
let notifyTimer: ReturnType<typeof setTimeout> | null = null;
let iabAttached = false;

/** Explicit non-null config wins over the CMP-read value, field by field. */
function resolve(): ConsentSnapshot {
  return {
    hasPrivacyConsent: explicit.hasPrivacyConsent ?? true,
    tcString: explicit.tcString ?? iab.tcString,
    uspString: explicit.uspString ?? iab.uspString,
    gppString: explicit.gppString ?? iab.gppString,
    gppSid: explicit.gppSid ?? iab.gppSid,
    gdprApplies: explicit.gdprApplies ?? iab.gdprApplies,
    coppaApplies: explicit.coppaApplies ?? false,
    tcfPurpose1Consent: explicit.tcfPurpose1Consent ?? iab.tcfPurpose1Consent,
    advertisingId: undefined,
  };
}

function applySideEffects(next: ConsentSnapshot, prev: ConsentSnapshot): void {
  // Storage consent gate is driven live by the resolved snapshot
  SimulaStorage.setLocalStorageAllowed(allowsLocalStorage(next));

  if (notifyTimer !== null) clearTimeout(notifyTimer);
  notifyTimer = setTimeout(() => {
    notifyTimer = null;
    listeners.forEach((listener) => {
      try {
        listener(next);
      } catch {
        // A broken host listener must never break the SDK
      }
    });
  }, NOTIFY_DEBOUNCE_MS);
}

function commitSnapshot(): void {
  const prev = snapshot;
  const next = resolve();
  if (JSON.stringify(next) === JSON.stringify(prev)) return;
  snapshot = next;
  applySideEffects(next, prev);
}

function onIabUpdate(signals: IabSignals): void {
  iab = { ...iab, ...signals };
  commitSnapshot();
}

export const SimulaPrivacy = {
  /**
   * Attach CMP auto-read and resolve the initial snapshot. Idempotent; called
   * by `SimulaAds.initialize` (hosts do not need to call this).
   */
  attach(): void {
    if (iabAttached) return;
    iabAttached = true;
    try {
      attachIabListeners(onIabUpdate);
    } catch (error) {
      logger.debug('IAB CMP auto-read unavailable:', error);
    }
    SimulaStorage.setLocalStorageAllowed(allowsLocalStorage(snapshot));
  },

  /** Full-replace the explicit config (mirrors native `SimulaPrivacy.apply`). */
  apply(config: SimulaPrivacyConfig): void {
    explicit = { ...config };
    commitSnapshot();
  },

  /** Partial-merge the explicit config (mirrors native `SimulaPrivacy.update`). */
  update(config: SimulaPrivacyConfig): void {
    explicit = { ...explicit, ...config };
    commitSnapshot();
  },

  /** Clear explicit overrides, reverting to CMP-read values (mirrors native `clearConsent`). */
  clearConsent(): void {
    explicit = { hasPrivacyConsent: explicit.hasPrivacyConsent, coppaApplies: explicit.coppaApplies };
    commitSnapshot();
  },

  /** The current resolved snapshot (live read, never cached by callers). */
  get current(): ConsentSnapshot {
    return snapshot;
  },

  /** Subscribe to resolved-consent changes (debounced 300ms, native parity). */
  subscribe(listener: PrivacyListener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  /** Test hook. Not public API. */
  _resetForTests(): void {
    explicit = {};
    iab = {};
    snapshot = resolve();
    listeners = new Set();
    iabAttached = false;
    if (notifyTimer !== null) {
      clearTimeout(notifyTimer);
      notifyTimer = null;
    }
  },
};
