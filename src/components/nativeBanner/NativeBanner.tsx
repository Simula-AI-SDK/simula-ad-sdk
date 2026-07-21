import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useSimula } from '../../SimulaProvider';
import { SimulaAds } from '../../core/SimulaAds';
import { useBotDetection } from '../../hooks/useBotDetection';
import { loadNativeAd, trackImpression, LoadedCreative } from '../../utils/api';
import { validateNativeBannerProps } from '../../utils/validation';
import { filterContextForPrivacy } from '../../types';
import { SimulaPrivacy, allowsPrimaryUserID } from '../../privacy/SimulaPrivacy';
import { Telemetry } from '../../telemetry/telemetry';
import { adValueFromBidCpm } from '../../core/adValue';
import { SimulaAdError, NativeAdError } from '../../ads/errors';
import { attachCreativeBridge, BRIDGE_AD_SIZE } from '../../bridge/creativeBridge';
import { injectSrcdocRelay } from '../../bridge/srcdocRelay';
import {
  getCachedNativeAd,
  cacheNativeAd,
  hasNativeNoFill,
  markNativeNoFill,
  isImpressionServed,
  markImpressionServed,
  markNativeImpressionFired,
} from '../../nativeAd/nativeAdCache';
import { consumePreloadedAd } from '../../nativeAd/preloadCache';
import { resolveNativeAdTheme } from '../../nativeAd/theme';
import { NativeAdProps, NativeAdData } from '../../nativeAd/types';
import { RadialLinesSpinner } from './RadialLinesSpinner';
import { parseWidth, needsWidthMeasurement } from '../../utils/parseWidth';

// Native parity: the card enforces a 300px minimum width
const MIN_WIDTH_PX = 300;
// Cross-origin creatives can't be measured from the parent — sensible default
const DEFAULT_IFRAME_HEIGHT = 250;

/** Map a load-layer error to the public NativeAdError subset (native parity). */
function toNativeAdError(error: SimulaAdError): NativeAdError {
  const code = (
    ['not_initialized', 'no_session', 'no_fill', 'network', 'ad_unit_not_found'] as const
  ).includes(error.code as any)
    ? (error.code as NativeAdError['code'])
    : 'network';
  return { code, message: error.message };
}

export const NativeBanner: React.FC<NativeAdProps> = React.memo((props) => {
  const {
    slot,
    width,
    position,
    context,
    theme,
    preloadedAdId,
    previewHtml,
    loadingComponent,
    onLoad,
    onImpression,
    onPaid,
    onClick,
    onError,
  } = props;

  const {
    apiKey,
    sessionId,
    devMode,
    getCachedHeight,
    cacheHeight,
  } = useSimula();

  // Validate props on EVERY render: a slot mounted with temporarily-invalid
  // props recovers once they become valid; each unique failure logs only once
  // (strict mode — devMode — throws during integration).
  const propsValid = validateNativeBannerProps(props, devMode);

  // Minimal state - only what's needed for rendering
  const [creative, setCreative] = useState<LoadedCreative | null>(null);
  const [error, setError] = useState<NativeAdError | null>(null);
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);
  const [iframeHeight, setIframeHeight] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Refs for tracking (no re-renders)
  const elementRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const hasFetchedRef = useRef(false);
  const impressionTrackedRef = useRef(false);
  const hasMetDurationRef = useRef(false);
  const creativeRef = useRef<LoadedCreative | null>(null);
  const viewabilityStartedAtRef = useRef<number>(0);
  const onImpressionRef = useRef(onImpression);
  const onPaidRef = useRef(onPaid);
  const onErrorRef = useRef(onError);
  const onLoadRef = useRef(onLoad);
  const onClickRef = useRef(onClick);
  const detachBridgeRef = useRef<(() => void) | null>(null);
  // Dedup window for a single tap seen by BOTH the DOM-capture path (same-origin
  // fallback) and the bridge CTA_CLICK path — one tap, one click event.
  const lastClickAtRef = useRef(0);

  const fireClick = useCallback((c: LoadedCreative, openTarget: boolean, handled = false) => {
    const now = Date.now();
    if (now - lastClickAtRef.current < 300) return;
    lastClickAtRef.current = now;
    onClickRef.current?.();
    Telemetry.recordLifecycle('click', { adFormat: 'native', adUnitId: slot, adId: c.impressionId });
    if (openTarget && !handled) {
      const target = c.trackingUrl ?? c.storeUrl;
      if (target) {
        try {
          window.open(target, '_blank', 'noopener');
        } catch {
          // Popup blocked — click already recorded
        }
      }
    }
  }, [slot]);

  useEffect(() => {
    onImpressionRef.current = onImpression;
    onPaidRef.current = onPaid;
    onErrorRef.current = onError;
    onLoadRef.current = onLoad;
    onClickRef.current = onClick;
  }, [onImpression, onPaid, onError, onLoad, onClick]);

  useEffect(() => {
    creativeRef.current = creative;
  }, [creative]);

  const { isBot } = useBotDetection();

  const nativeAdData = useCallback((c: LoadedCreative): NativeAdData => ({
    impressionId: c.impressionId,
    adFormat: c.adFormat || 'character_ad',
    adUnitId: slot,
  }), [slot]);

  const fail = useCallback((err: NativeAdError) => {
    setError(err);
    onErrorRef.current?.(err);
  }, []);

  // Restore a cached slot height immediately (avoid feed reflow jolts)
  useEffect(() => {
    const cachedHeight = getCachedHeight(slot, position);
    if (cachedHeight !== null && iframeHeight === null) {
      setIframeHeight(cachedHeight);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slot, position]);

  // Measure width once (only if needed)
  useEffect(() => {
    if (!propsValid) return;
    const needsMeasurement = needsWidthMeasurement(width);
    if (!needsMeasurement || !elementRef.current || measuredWidth !== null) return;

    let hasMeasured = false;
    const resizeObserver = new ResizeObserver(entries => {
      const entry = entries[0];
      if (entry && !hasMeasured) {
        hasMeasured = true;
        const measuredW = Math.round(entry.contentRect.width);
        const finalWidth = (width == null || width === 0 || width === 1) ? Math.max(measuredW, MIN_WIDTH_PX) : measuredW;
        setMeasuredWidth(finalWidth);
        resizeObserver.disconnect();
      }
    });

    resizeObserver.observe(elementRef.current);
    return () => resizeObserver.disconnect();
  }, [width, measuredWidth, propsValid]);

  // Adopt a creative (from any source) and wire height/onLoad handling
  const adoptCreative = useCallback((c: LoadedCreative, cacheSource: 'preload' | 'cache' | 'network') => {
    setCreative(c);
    Telemetry.recordLifecycle('native_render', { adFormat: 'native', adUnitId: slot, adId: c.impressionId, cacheSource });
  }, [slot]);

  // Fetch ad once (native contract: POST /load/native)
  useEffect(() => {
    if (!propsValid || hasFetchedRef.current || error || creative) return;

    // QA preview: render through the full pipeline without network/impression
    if (previewHtml) {
      hasFetchedRef.current = true;
      adoptCreative({ impressionId: 'preview', renderedHtml: previewHtml, destination: 'web', bidAmt: 0, adBehavior: null }, 'cache');
      return;
    }

    if (!sessionId) return;

    // Preloaded ad consumption (single use)
    if (preloadedAdId) {
      const preloaded = consumePreloadedAd(preloadedAdId);
      if (preloaded && !isImpressionServed(preloaded.creative.impressionId)) {
        hasFetchedRef.current = true;
        adoptCreative(preloaded.creative, 'preload');
        Telemetry.recordLifecycle('load_success', { adFormat: 'native', adUnitId: slot, adId: preloaded.creative.impressionId, cacheSource: 'preload' });
        return;
      }
      // Missing/unknown preloaded id → fall through to a live load (fail-open)
    }

    // Per-slot cache (one serve/impression per slot across feed recycling)
    const cached = getCachedNativeAd(slot, position);
    if (cached && !isImpressionServed(cached.creative.impressionId)) {
      hasFetchedRef.current = true;
      adoptCreative(cached.creative, 'cache');
      Telemetry.recordLifecycle('load_success', { adFormat: 'native', adUnitId: slot, adId: cached.creative.impressionId, cacheSource: 'cache' });
      return;
    }

    if (hasNativeNoFill(slot, position)) {
      hasFetchedRef.current = true;
      fail({ code: 'no_fill', message: SimulaAdError.noFill().message });
      return;
    }

    // Block bots
    if (isBot) {
      hasFetchedRef.current = true;
      return;
    }

    // Wait for width measurement if needed
    const needsMeasurement = needsWidthMeasurement(width);
    if (needsMeasurement && measuredWidth === null) return;

    hasFetchedRef.current = true;

    const startedAt = Date.now();
    const mergedContext = context ?? SimulaAds.getContext() ?? undefined;
    const filteredContext = mergedContext
      ? filterContextForPrivacy(mergedContext, allowsPrimaryUserID(SimulaPrivacy.current))
      : undefined;

    loadNativeAd({
      apiKey,
      position,
      sessionId,
      adUnitId: slot,
      context: filteredContext,
      width: measuredWidth !== null ? String(measuredWidth) : undefined,
      theme: resolveNativeAdTheme(theme ?? null),
    }).then(result => {
      if (result.error || !result.creative) {
        const adError = result.error ?? SimulaAdError.noFill();
        markNativeNoFill(slot, position);
        fail(toNativeAdError(adError));
        Telemetry.recordLifecycle('load_fail', { adFormat: 'native', adUnitId: slot, durationMs: Date.now() - startedAt, errorCode: adError.code });
      } else {
        cacheNativeAd(slot, position, result.creative);
        adoptCreative(result.creative, 'network');
        Telemetry.recordLifecycle('load_success', { adFormat: 'native', adUnitId: slot, adId: result.creative.impressionId, durationMs: Date.now() - startedAt, cacheSource: 'network' });
      }
    }).catch(err => {
      fail({ code: 'network', message: err instanceof Error ? err.message : 'Failed to fetch ad' });
      Telemetry.recordLifecycle('load_fail', { adFormat: 'native', adUnitId: slot, durationMs: Date.now() - startedAt, errorCode: 'network' });
    });
  }, [sessionId, slot, position, context, theme, width, measuredWidth, error, creative, apiKey, isBot, preloadedAdId, previewHtml, propsValid, adoptCreative, fail]);

  // Iframe load → wire height measurement, CTA capture, and onLoad
  useEffect(() => {
    if (!creative || !iframeRef.current) return;
    const iframe = iframeRef.current;
    let resizeObserver: ResizeObserver | null = null;

    const reportHeight = (h: number) => {
      const rounded = Math.ceil(h);
      if (rounded > 0) {
        setIframeHeight((prev) => (prev === rounded ? prev : rounded));
        cacheHeight(slot, position, rounded);
      }
    };

    const onIframeLoad = () => {
      setLoaded(true);
      onLoadRef.current?.(nativeAdData(creative));

      // srcdoc (same-origin fallback): measure content height + capture CTA
      // taps directly. Inoperable when the sandbox gives an opaque origin —
      // height/clicks then arrive over the bridge (below).
      if (creative.renderedHtml) {
        try {
          const doc = iframe.contentDocument;
          if (doc && doc.body) {
            reportHeight(doc.body.scrollHeight || doc.documentElement.scrollHeight);
            resizeObserver = new ResizeObserver(() => {
              reportHeight(doc.body.scrollHeight || doc.documentElement.scrollHeight);
            });
            resizeObserver.observe(doc.body);
            doc.addEventListener('click', () => fireClick(creative, false), true);
          }
        } catch {
          // Cross-origin guard — fall back to the bridge paths
        }
      }
    };

    iframe.addEventListener('load', onIframeLoad);

    // Cross-origin creatives: CTA + sizing arrive over the bridge
    detachBridgeRef.current = attachCreativeBridge(iframe, {
      onCtaClick: (_url, handled) => fireClick(creative, true, handled === true),
    });

    // Web sizing extension: creatives can post { type: 'SIMULA_AD_SIZE', payload: { height } }
    const onMessage = (event: MessageEvent) => {
      try {
        if (event.source !== iframe.contentWindow) return;
        const data: any = event.data;
        if (data && data.type === BRIDGE_AD_SIZE && data.payload && typeof data.payload.height === 'number') {
          reportHeight(data.payload.height);
        }
      } catch {
        // ignore malformed creative messages
      }
    };
    window.addEventListener('message', onMessage);

    return () => {
      iframe.removeEventListener('load', onIframeLoad);
      resizeObserver?.disconnect();
      detachBridgeRef.current?.();
      detachBridgeRef.current = null;
      window.removeEventListener('message', onMessage);
    };
  }, [creative, slot, position, cacheHeight, nativeAdData, fireClick]);

  // Viewability → billable impression (MRC: ≥50% visible, 1 continuous second)
  useEffect(() => {
    if (!propsValid || !creative || !elementRef.current || isBot || previewHtml || impressionTrackedRef.current) return;

    const threshold = 0.5;
    const durationMs = 1000;
    const currentCreative = creative;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const fireImpression = () => {
      if (impressionTrackedRef.current) return;
      impressionTrackedRef.current = true;
      markImpressionServed(currentCreative.impressionId);
      markNativeImpressionFired(slot, position);
      trackImpression(currentCreative.impressionId, apiKey);
      const data = nativeAdData(currentCreative);
      onImpressionRef.current?.(data);
      // PAID co-fires with the impression — co-fire, do not decouple (native parity)
      const adValue = adValueFromBidCpm(currentCreative.bidAmt);
      onPaidRef.current?.(adValue);
      Telemetry.recordLifecycle('impression', { adFormat: 'native', adUnitId: slot, adId: currentCreative.impressionId });
      Telemetry.recordLifecycle('paid', { adFormat: 'native', adUnitId: slot, adId: currentCreative.impressionId });
      Telemetry.recordLifecycle('viewability', { adFormat: 'native', adUnitId: slot, adId: currentCreative.impressionId, durationMs: Date.now() - viewabilityStartedAtRef.current });
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        const viewable = entry.intersectionRatio >= threshold;
        if (viewable) {
          if (timer === null && !hasMetDurationRef.current) {
            timer = setTimeout(() => {
              timer = null;
              hasMetDurationRef.current = true;
              fireImpression();
            }, durationMs);
          }
        } else {
          if (timer !== null) {
            clearTimeout(timer);
            timer = null;
          }
          hasMetDurationRef.current = false;
        }
      },
      { threshold, rootMargin: '0px' }
    );

    viewabilityStartedAtRef.current = Date.now();
    observer.observe(elementRef.current);

    return () => {
      observer.disconnect();
      if (timer !== null) clearTimeout(timer);
    };
  }, [creative, isBot, apiKey, slot, position, previewHtml, propsValid, nativeAdData]);

  // Calculate container dimensions (memoized, no re-renders)
  const containerWidth = useMemo(() => {
    const parsedWidth = parseWidth(width);
    if (parsedWidth.type === 'fill') {
      return '100%';
    } else if (parsedWidth.type === 'percentage' && parsedWidth.value !== undefined) {
      return `${parsedWidth.value * 100}%`;
    } else if (parsedWidth.type === 'pixels' && parsedWidth.value !== undefined) {
      return `${Math.max(Math.round(parsedWidth.value), MIN_WIDTH_PX)}px`;
    }
    return '100%';
  }, [width]);

  // ── Render ───────────────────────────────────────────────────────────────
  if (!propsValid) return null;
  if (error) return null;

  // Loading state: shimmer/spinner placeholder (native parity: shimmer while loading)
  if (!creative) {
    const LoadingIndicator = loadingComponent === null ? null : (loadingComponent ?? RadialLinesSpinner);
    return (
      <div
        ref={elementRef}
        className="simula-native-banner"
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          width: containerWidth,
          minWidth: `${MIN_WIDTH_PX}px`,
          height: LoadingIndicator ? '120px' : '0px',
          overflow: 'hidden',
        }}
      >
        {LoadingIndicator ? <LoadingIndicator /> : null}
      </div>
    );
  }

  const isSrcdoc = !!creative.renderedHtml;
  const height = iframeHeight ?? getCachedHeight(slot, position) ?? DEFAULT_IFRAME_HEIGHT;

  return (
    <div
      ref={elementRef}
      className="simula-native-banner"
      style={{
        display: 'block',
        width: containerWidth,
        minWidth: `${MIN_WIDTH_PX}px`,
        height: `${height}px`,
        overflow: 'hidden',
        transition: 'height 120ms ease-out',
      }}
    >
      <iframe
        ref={iframeRef}
        title={`Simula native ad ${creative.impressionId}`}
        className="simula-native-banner-frame"
        style={{ display: 'block', width: '100%', height: '100%', border: 0, margin: 0, padding: 0, opacity: loaded ? 1 : 0, transition: 'opacity 120ms ease-in' }}
        // srcdoc creatives get an OPAQUE origin (no allow-same-origin): the
        // creative can never touch the host page's DOM/cookies/storage. Height
        // and clicks flow over the bridge — the SDK injects a relay script
        // into srcdoc HTML that lacks one (see bridge/srcdocRelay).
        sandbox={isSrcdoc
          ? 'allow-scripts allow-popups allow-popups-to-escape-sandbox'
          : 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox'}
        {...(isSrcdoc ? { srcDoc: injectSrcdocRelay(creative.renderedHtml!) } : { src: creative.iframeUrl })}
      />
    </div>
  );
});

NativeBanner.displayName = 'NativeBanner';
