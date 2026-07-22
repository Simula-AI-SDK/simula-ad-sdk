import { AdValue } from '../core/adValue';
import { NativeAdError } from '../ads/errors';
import { SimulaNativeAdTheme } from './theme';

export type { SimulaNativeAdTheme };

/**
 * Impression payload for the native inline ad (native parity: `NativeAdData`).
 */
export interface NativeAdData {
  impressionId: string;
  adFormat: string;
  adUnitId?: string;
}

/** Props for the `<NativeBanner>` inline native ad component. */
export interface NativeAdProps {
  /** Placement identifier (the ad unit id, e.g. "feed", "explore"). */
  slot: string;
  /**
   * Ad width. Supports: number < 1 (fraction), number >= 1 (px),
   * "80%", "500", "500px", "auto"/null (fills container, min 300px).
   */
  width?: number | string | null;
  /** Feed position — one serve/impression per (slot, position) across recycling. */
  position: number;
  /** Targeting context; merged over the global `SimulaAds.updateContext` value. */
  context?: import('../types').NativeContext;
  /** Card theme. "system" follows the OS preference. */
  theme?: SimulaNativeAdTheme;
  /** A preloaded ad id from `SimulaAds.preloadNativeAd` — consumes it (single use). */
  preloadedAdId?: string;
  /** QA/debug: render this HTML through the full pipeline (no network, no impression). */
  previewHtml?: string;
  /**
   * Custom loading component while the ad loads.
   * undefined: default spinner · null: no loading indicator · ComponentType: custom.
   */
  loadingComponent?: import('react').ComponentType | null;
  /** The creative finished loading and is ready to display. */
  onLoad?: (data: NativeAdData) => void;
  /** MRC billable impression (≥50% visible for 1 continuous second). */
  onImpression?: (data: NativeAdData) => void;
  /** Estimated revenue, co-fired with the impression (native parity: onPaid). */
  onPaid?: (value: AdValue) => void;
  /** Gesture-initiated CTA tap inside the creative. */
  onClick?: () => void;
  /** Load/render failure — the slot collapses to zero height. */
  onError?: (error: NativeAdError) => void;
}
