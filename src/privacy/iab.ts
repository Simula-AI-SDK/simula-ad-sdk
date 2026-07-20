/**
 * IAB consent-framework auto-read for the web. Mirrors the native SDKs reading
 * the IAB-standard keys a CMP writes (`IABTCF_*`, `IABUSPrivacy_String`,
 * `IABGPP_*`); on the web the standard surfaces are the CMP global functions:
 *
 * - TCF v2.2  → `window.__tcfapi`   (tcString, gdprApplies, Purpose 1 consent)
 * - CCPA/USP  → `window.__uspapi`   (uspString, e.g. "1YNN")
 * - GPP       → `window.__gpp`      (gppString, applicable section IDs)
 *
 * Everything is feature-detected and individually guarded: a missing/broken
 * CMP yields no signals (never throws into the host page). Event-driven where
 * the API supports listeners — no polling.
 */

export interface IabSignals {
  tcString?: string;
  gdprApplies?: boolean;
  tcfPurpose1Consent?: boolean;
  uspString?: string;
  gppString?: string;
  gppSid?: string;
}

type IabListener = (signals: IabSignals) => void;

let attached = false;

/** Attach CMP listeners once. `onUpdate` fires on the initial read and every later change. */
export function attachIabListeners(onUpdate: IabListener): void {
  if (attached || typeof window === 'undefined') return;
  attached = true;
  attachTcf(onUpdate);
  attachUsp(onUpdate);
  attachGpp(onUpdate);
}

// ── TCF v2.2 ────────────────────────────────────────────────────────────────

function attachTcf(onUpdate: IabListener): void {
  try {
    const tcfapi = (window as any).__tcfapi;
    if (typeof tcfapi !== 'function') return;

    tcfapi('addEventListener', 2, (tcData: any, success: boolean) => {
      try {
        if (!success || !tcData) return;
        // Only terminal states carry a usable consent string
        const status = tcData.eventStatus;
        if (status !== 'tcloaded' && status !== 'useractioncomplete') return;
        onUpdate({
          tcString: typeof tcData.tcString === 'string' && tcData.tcString ? tcData.tcString : undefined,
          gdprApplies: typeof tcData.gdprApplies === 'boolean' ? tcData.gdprApplies : undefined,
          tcfPurpose1Consent:
            tcData.purpose && tcData.purpose.consents && typeof tcData.purpose.consents['1'] === 'boolean'
              ? tcData.purpose.consents['1']
              : undefined,
        });
      } catch {
        // Broken CMP payload — ignore
      }
    });
  } catch {
    // No usable TCF CMP — skip
  }
}

// ── US Privacy (CCPA) ───────────────────────────────────────────────────────

function attachUsp(onUpdate: IabListener): void {
  try {
    const uspapi = (window as any).__uspapi;
    if (typeof uspapi !== 'function') return;

    uspapi('getUSPData', 1, (data: any, success: boolean) => {
      try {
        if (!success || !data) return;
        const uspString = typeof data.uspString === 'string' && data.uspString ? data.uspString : undefined;
        if (uspString) onUpdate({ uspString });
      } catch {
        // Ignore
      }
    });
  } catch {
    // No USP CMP — skip
  }
}

// ── GPP ─────────────────────────────────────────────────────────────────────

function attachGpp(onUpdate: IabListener): void {
  try {
    const gpp = (window as any).__gpp;
    if (typeof gpp !== 'function') return;

    const emit = (data: any) => {
      try {
        if (!data) return;
        const gppString = typeof data.gppString === 'string' && data.gppString ? data.gppString : undefined;
        const sections: unknown = data.applicableSections;
        const gppSid = Array.isArray(sections) && sections.length > 0 ? sections.join(',') : undefined;
        if (gppString || gppSid) onUpdate({ gppString, gppSid });
      } catch {
        // Ignore
      }
    };

    // Current snapshot
    gpp('getGppData', (data: any) => emit(data));
    // Changes
    gpp('addEventListener', (event: any) => {
      const data = event && event.data ? event.data : event;
      emit(data);
    });
  } catch {
    // No GPP CMP — skip
  }
}

/** Test hook. Not public API. */
export function _resetIabForTests(): void {
  attached = false;
}
