/**
 * Server-driven `ad_behavior` parser — web port of the Kotlin SDK's
 * `model/Types.kt` behavior tree. Tolerant by contract: every unknown/missing
 * enum value falls back to the safest default, and the close delay is clamped
 * to [0, MAX_CLOSE_DELAY_SECONDS] so a malformed payload can never trap the
 * user behind a blocked close.
 */

export const MAX_CLOSE_DELAY_SECONDS = 45;

function normalizeBehaviorToken(raw: string | null | undefined): string {
  return (raw ?? '').toLowerCase().replace(/-/g, '_');
}

/** Accepts an optional leading `#` + exactly 6 hex digits; anything else → white. Returns WITH `#`. */
export function validatedHexColor(raw: string | null | undefined, fallback = '#FFFFFF'): string {
  if (!raw) return fallback;
  const body = raw.replace(/^#/, '');
  const isHex = body.length === 6 && /^[0-9a-fA-F]{6}$/.test(body);
  return isHex ? '#' + body.toUpperCase() : fallback;
}

// ── Enums (unknown/missing → safest default; native parity) ─────────────────

/** Close-button visual treatment. Unknown/missing → HIDDEN (never presents a false tap target). */
export type CloseTreatment = 'hidden' | 'countdown_circle' | 'progress_bar' | 'reward_or_close_label';
export function closeTreatmentFrom(raw?: string | null): CloseTreatment {
  switch (normalizeBehaviorToken(raw)) {
    case 'countdown_circle':
      return 'countdown_circle';
    case 'progress_bar':
      return 'progress_bar';
    case 'reward_or_close_label':
      return 'reward_or_close_label';
    default:
      return 'hidden';
  }
}

/** Close button corner. bottom_right is excluded (collides with OS nav) → TOP_RIGHT. */
export type ClosePosition = 'top_right' | 'top_left' | 'bottom_left';
export function closePositionFrom(raw?: string | null): ClosePosition {
  switch (normalizeBehaviorToken(raw)) {
    case 'top_left':
      return 'top_left';
    case 'bottom_left':
      return 'bottom_left';
    default:
      return 'top_right';
  }
}

/** How a CTA tap opens the store/destination. Web: only EXTERNAL is actionable (new tab). */
export type StoreOpen = 'external' | 'skstoreproduct' | 'inline_install';
export function storeOpenFrom(raw?: string | null): StoreOpen {
  switch (normalizeBehaviorToken(raw)) {
    case 'external':
    case 'external_browser':
      return 'external';
    case 'inline_install':
      return 'inline_install';
    default:
      return 'skstoreproduct';
  }
}

/** Ad format, used to pick `reward_or_close_label` copy. Unknown/missing → INTERSTITIAL. */
export type AdUnitType = 'rewarded' | 'interstitial';
export function adUnitTypeFrom(raw?: string | null): AdUnitType {
  return normalizeBehaviorToken(raw) === 'rewarded' ? 'rewarded' : 'interstitial';
}

/** Creative-lifecycle moment at which an enabled auto_store_redirect fires. */
export type AutoStoreRedirectTrigger = 'playable_end' | 'end_screen_1_open' | 'end_screen_2_open';
export function autoStoreRedirectTriggerFrom(raw?: string | null): AutoStoreRedirectTrigger {
  switch (normalizeBehaviorToken(raw)) {
    case 'end_screen_1_open':
      return 'end_screen_1_open';
    case 'end_screen_2_open':
      return 'end_screen_2_open';
    default:
      return 'playable_end';
  }
}

// ── Domain model ────────────────────────────────────────────────────────────

export interface CloseBehavior {
  delaySeconds: number;
  treatment: CloseTreatment;
  position: ClosePosition;
  progressBarColor: string;
}

export interface Creative {
  type: string;
  bundleUrl?: string;
  adUnitType: AdUnitType;
}

export interface Experiment {
  experimentId?: string;
  variantId?: string;
  layer?: string;
}

export interface AutoStoreRedirect {
  enabled: boolean;
  trigger: AutoStoreRedirectTrigger;
}

export interface AdBehavior {
  close: CloseBehavior;
  storeOpen: StoreOpen;
  autoStoreRedirect?: AutoStoreRedirect;
}

const DEFAULT_CLOSE: CloseBehavior = {
  delaySeconds: 0,
  treatment: 'hidden',
  position: 'top_right',
  progressBarColor: '#FFFFFF',
};

export function defaultCloseBehavior(): CloseBehavior {
  return { ...DEFAULT_CLOSE };
}

/** Maps the wire `close` node to the domain model (delay clamped, hex validated). */
export function parseCloseBehavior(wire: any): CloseBehavior {
  if (!wire || typeof wire !== 'object') return defaultCloseBehavior();
  const rawDelay = typeof wire.delay_seconds === 'number' && Number.isFinite(wire.delay_seconds) ? wire.delay_seconds : 0;
  return {
    delaySeconds: Math.min(Math.max(Math.round(rawDelay), 0), MAX_CLOSE_DELAY_SECONDS),
    treatment: closeTreatmentFrom(wire.treatment),
    position: closePositionFrom(wire.position),
    progressBarColor: validatedHexColor(wire.progress_bar_color),
  };
}

/** Maps the wire `ad_behavior` node to the domain model. A null/absent node stays null. */
export function parseAdBehavior(wire: any): AdBehavior | null {
  if (!wire || typeof wire !== 'object') return null;
  const asr = wire.auto_store_redirect;
  return {
    close: parseCloseBehavior(wire.close),
    storeOpen: storeOpenFrom(wire.store_open),
    autoStoreRedirect:
      asr && typeof asr === 'object'
        ? { enabled: asr.enabled === true, trigger: autoStoreRedirectTriggerFrom(asr.trigger) }
        : undefined,
  };
}

/** Maps the wire `creative` node. Null stays null. */
export function parseCreative(wire: any): Creative | null {
  if (!wire || typeof wire !== 'object') return null;
  return {
    type: typeof wire.type === 'string' ? wire.type : '',
    bundleUrl: typeof wire.bundle_url === 'string' ? wire.bundle_url : undefined,
    adUnitType: adUnitTypeFrom(wire.ad_unit_type),
  };
}

/** Maps the wire `experiment` node (telemetry-only metadata). Null stays null. */
export function parseExperiment(wire: any): Experiment | null {
  if (!wire || typeof wire !== 'object') return null;
  return {
    experimentId: typeof wire.experiment_id === 'string' ? wire.experiment_id : undefined,
    variantId: typeof wire.variant_id === 'string' ? wire.variant_id : undefined,
    layer: typeof wire.layer === 'string' ? wire.layer : undefined,
  };
}
