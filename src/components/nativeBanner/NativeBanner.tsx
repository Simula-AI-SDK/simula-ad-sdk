import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSimula } from '../../SimulaProvider';
import { useBotDetection } from '../../hooks/useBotDetection';
import { fetchNativeBannerAd, trackImpression } from '../../utils/api';
import { validateNativeBannerProps } from '../../utils/validation';
import { NativeBannerProps, AdData, filterContextForPrivacy } from '../../types';

// Internal constant to prevent API abuse
const MIN_FETCH_INTERVAL_MS = 1000; // 1 second minimum between fetches

// Helper functions for dimension validation
const isPercentageWidth = (width: number | null | undefined): boolean => width != null && width > 0 && width < 1;
const isPixelWidth = (width: number | null | undefined): boolean => width != null && width > 1;
const needsWidthMeasurement = (width: number | null | undefined): boolean => width == null || width === 0 || width === 1 || isPercentageWidth(width);

export const NativeBanner: React.FC<NativeBannerProps> = React.memo((props) => {
  // Validate props early
  validateNativeBannerProps(props);

  const {
    slot,
    width,
    position,
    context,
    onImpression,
    onError,
  } = props;

  const { 
    apiKey, 
    sessionId, 
    hasPrivacyConsent,
    getCachedAd,
    cacheAd,
    hasNoFill,
    markNoFill,
  } = useSimula();

  // Single state: the ad data. Once set, never changes.
  const [ad, setAd] = useState<AdData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);
  const [measuredHeight, setMeasuredHeight] = useState<number | null>(null);

  const elementRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const hasFetchedRef = useRef(false);
  const lastFetchTimeRef = useRef<number>(0);
  const impressionTrackedRef = useRef(false);
  const viewableStartTimeRef = useRef<number | null>(null);
  const hasMetDurationRef = useRef(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const { isBot } = useBotDetection();

  // Measure width once (only if needed)
  useEffect(() => {
    const needsMeasurement = needsWidthMeasurement(width);
    if (!needsMeasurement || !elementRef.current || measuredWidth !== null) return;

    let hasMeasured = false;
    const resizeObserver = new ResizeObserver(entries => {
      const entry = entries[0];
      if (entry && !hasMeasured) {
        hasMeasured = true;
        const measuredW = Math.round(entry.contentRect.width);
        const finalWidth = (width == null || width === 0 || width === 1) ? Math.max(measuredW, 200) : measuredW;
        setMeasuredWidth(finalWidth);
        resizeObserver.disconnect();
      }
    });

    resizeObserver.observe(elementRef.current);
    return () => resizeObserver.disconnect();
  }, [width, measuredWidth]);

  // Listen for height messages from iframe (only once, no re-renders)
  useEffect(() => {
    if (!ad?.iframeUrl) return;

    const handleMessage = (event: MessageEvent) => {
      if (!iframeRef.current?.contentWindow || event.source !== iframeRef.current.contentWindow) {
        return;
      }
      
      if (event.data?.type === 'AD_HEIGHT' && typeof event.data.height === 'number' && event.data.height > 0) {
        setMeasuredHeight(event.data.height);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [ad?.iframeUrl]);

  // Viewability tracking with IntersectionObserver (no re-renders)
  useEffect(() => {
    if (!ad || !elementRef.current || isBot || impressionTrackedRef.current) return;

    const threshold = 0.5;
    const durationMs = 1000; // 1 second for MRC compliance

    const observer = new IntersectionObserver(
      ([entry]) => {
        const viewable = entry.intersectionRatio >= threshold;
        const now = Date.now();
        
        if (viewable) {
          if (viewableStartTimeRef.current === null) {
            viewableStartTimeRef.current = now;
          }
          
          // Check if duration has been met
          if (!hasMetDurationRef.current && viewableStartTimeRef.current !== null) {
            const elapsed = now - viewableStartTimeRef.current;
            if (elapsed >= durationMs) {
              hasMetDurationRef.current = true;
              // Track impression once
              if (!impressionTrackedRef.current && ad) {
                impressionTrackedRef.current = true;
                trackImpression(ad.id, apiKey);
                onImpression?.(ad);
              }
            }
          }
        } else {
          // Reset when not viewable
          viewableStartTimeRef.current = null;
          hasMetDurationRef.current = false;
        }
      },
      { 
        threshold,
        rootMargin: '0px'
      }
    );

    observer.observe(elementRef.current);
    observerRef.current = observer;

    // Also check periodically for duration (in case intersection doesn't fire)
    const intervalId = setInterval(() => {
      if (viewableStartTimeRef.current !== null && !hasMetDurationRef.current) {
        const elapsed = Date.now() - viewableStartTimeRef.current;
        if (elapsed >= durationMs) {
          hasMetDurationRef.current = true;
          if (!impressionTrackedRef.current && ad) {
            impressionTrackedRef.current = true;
            trackImpression(ad.id, apiKey);
            onImpression?.(ad);
          }
        }
      }
    }, 100);

    return () => {
      observer.disconnect();
      observerRef.current = null;
      clearInterval(intervalId);
    };
  }, [ad, isBot, apiKey, onImpression]);

  // Fetch ad once
  useEffect(() => {
    if (hasFetchedRef.current || !sessionId || error || ad) return;

    // Check cache first
    const cachedAd = getCachedAd(slot, position);
    if (cachedAd) {
      setAd(cachedAd);
      hasFetchedRef.current = true;
      // Don't track impression here - let viewability tracking handle it
      return;
    }

    // Check no-fill
    if (hasNoFill(slot, position)) {
      setError('No ad available');
      onError?.(new Error('No ad available'));
      hasFetchedRef.current = true;
      return;
    }

    // Block bots
    if (isBot) {
      hasFetchedRef.current = true;
      return;
    }

    // Wait for width measurement if needed
    const needsMeasurement = needsWidthMeasurement(width);
    if (needsMeasurement && measuredWidth === null) {
      return;
    }

    // Rate limiting
    const now = Date.now();
    if (now - lastFetchTimeRef.current < MIN_FETCH_INTERVAL_MS) {
      return;
    }

    hasFetchedRef.current = true;
    lastFetchTimeRef.current = now;

    // Calculate width
    let widthValue: number | undefined;
    if (width == null || width === 0 || width === 1) {
      widthValue = measuredWidth !== null ? Math.max(measuredWidth, 200) : undefined;
    } else if (isPercentageWidth(width)) {
      widthValue = measuredWidth !== null ? Math.max(Math.round(measuredWidth * width), 200) : undefined;
    } else if (isPixelWidth(width)) {
      widthValue = Math.max(Math.round(width), 200);
    }

    if (needsMeasurement && widthValue === undefined) {
      hasFetchedRef.current = false;
      return;
    }

    // Fetch ad
    const filteredContext = filterContextForPrivacy(context, hasPrivacyConsent);
    
    fetchNativeBannerAd({
      sessionId,
      slot,
      position,
      context: filteredContext,
      width: widthValue,
    }).then(result => {
      if (result.error) {
        setError(result.error);
        markNoFill(slot, position);
        onError?.(new Error(result.error));
      } else if (result.ad) {
        setAd(result.ad);
        cacheAd(slot, position, result.ad);
        // Don't track impression here - let viewability tracking handle it
      } else {
        setError('No ad available');
        markNoFill(slot, position);
        onError?.(new Error('No ad available'));
      }
    }).catch(err => {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch ad';
      setError(errorMessage);
      onError?.(new Error(errorMessage));
    });
  }, [sessionId, slot, position, context, width, measuredWidth, error, ad, apiKey, isBot, hasPrivacyConsent, onError, onImpression, getCachedAd, cacheAd, hasNoFill, markNoFill]);

  // Calculate container dimensions (memoized, no re-renders)
  const containerWidth = useMemo(() => {
    if (width == null || width === 0 || width === 1) {
      return '100%';
    } else if (isPercentageWidth(width)) {
      return `${width * 100}%`;
    } else if (isPixelWidth(width)) {
      return `${Math.max(Math.round(width), 200)}px`;
    }
    return '100%';
  }, [width]);

  const containerHeight = useMemo(() => {
    if (!ad) return '0px';
    if (ad.html) {
      return 'fit-content';
    }
    return measuredHeight ? `${measuredHeight}px` : '200px';
  }, [ad, measuredHeight]);

  // Render once, never changes
  if (error) {
    return null;
  }

  if (!ad) {
    return (
      <div
        ref={elementRef}
        className="simula-native-banner"
        style={{
          display: 'block',
          width: containerWidth,
          minWidth: '200px',
          height: '0px',
          overflow: 'hidden',
        }}
      />
    );
  }

  // Render HTML directly
  if (ad.html) {
    return (
      <div
        ref={elementRef}
        className="simula-native-banner"
        style={{
          display: 'block',
          width: containerWidth,
          minWidth: '200px',
          height: 'fit-content',
          overflow: 'hidden',
        }}
      >
        <div
          className="simula-native-banner-html"
          dangerouslySetInnerHTML={{ __html: ad.html }}
          style={{
            display: 'block',
            width: '100%',
            height: 'fit-content',
          }}
        />
      </div>
    );
  }

  // Render iframe (legacy)
  return (
    <div
      ref={elementRef}
      className="simula-native-banner"
      style={{
        display: 'block',
        width: containerWidth,
        minWidth: '200px',
        height: containerHeight,
        overflow: 'hidden',
      }}
    >
      <iframe
        ref={iframeRef}
        src={ad.iframeUrl}
        className="simula-native-banner-frame"
        style={{
          display: 'block',
          border: 0,
          margin: 0,
          padding: 0,
          width: '100%',
          height: measuredHeight ? `${measuredHeight}px` : '200px',
        }}
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        title={`Native Banner: ${ad.id}`}
      />
    </div>
  );
});

NativeBanner.displayName = 'NativeBanner';
