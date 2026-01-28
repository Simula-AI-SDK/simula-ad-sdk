import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSimula } from '../../SimulaProvider';
import { useBotDetection } from '../../hooks/useBotDetection';
import { useAssetLoadDetection } from '../../hooks/useAssetLoadDetection';
import { fetchNativeBannerAd, trackImpression, trackViewportEntry, trackViewportExit } from '../../utils/api';
import { validateNativeBannerProps } from '../../utils/validation';
import { NativeBannerProps, AdData, filterContextForPrivacy } from '../../types';
import { RadialLinesSpinner } from './RadialLinesSpinner';

// Internal constant to prevent API abuse
const MIN_FETCH_INTERVAL_MS = 1000; // 1 second minimum between fetches

// Helper functions for dimension validation and parsing
type WidthInput = number | string | null | undefined;

const parseWidth = (width: WidthInput): { type: 'fill' | 'percentage' | 'pixels'; value?: number } => {
  // Handle null, undefined, "auto"
  if (width == null || width === 'auto' || width === '') {
    return { type: 'fill' };
  }

  // Handle string percentages (e.g., "10%")
  if (typeof width === 'string' && width.endsWith('%')) {
    const percentValue = parseFloat(width);
    if (!isNaN(percentValue) && percentValue > 0 && percentValue <= 100) {
      return { type: 'percentage', value: percentValue / 100 };
    }
  }

  // Handle string pixels (e.g., "500")
  if (typeof width === 'string') {
    const pixelValue = parseFloat(width);
    if (!isNaN(pixelValue) && pixelValue > 0) {
      return { type: 'pixels', value: pixelValue };
    }
  }

  // Handle number < 1 as percentage (e.g., 0.8 = 80%)
  if (typeof width === 'number' && width > 0 && width < 1) {
    return { type: 'percentage', value: width };
  }

  // Handle number >= 1 as pixels (e.g., 500 = 500px)
  if (typeof width === 'number' && width >= 1) {
    return { type: 'pixels', value: width };
  }

  // Default to fill
  return { type: 'fill' };
};

const needsWidthMeasurement = (width: WidthInput): boolean => {
  const parsed = parseWidth(width);
  return parsed.type === 'fill' || parsed.type === 'percentage';
};

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
    loadingComponent: LoadingComponent,
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

  // Minimal state - only what's needed for rendering
  const [ad, setAd] = useState<AdData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);
  const [measuredHeight, setMeasuredHeight] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);

  // Refs for tracking (no re-renders)
  const elementRef = useRef<HTMLDivElement>(null);
  const htmlContentRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const hasFetchedRef = useRef(false);
  const lastFetchTimeRef = useRef<number>(0);
  const impressionTrackedRef = useRef(false);
  const viewableStartTimeRef = useRef<number | null>(null);
  const hasMetDurationRef = useRef(false);
  const wasInViewportRef = useRef(false);
  const adIdRef = useRef<string | null>(null);
  const adRef = useRef<AdData | null>(null);
  const onImpressionRef = useRef(onImpression);
  const onErrorRef = useRef(onError);
  const errorHandledRef = useRef(false);

  // Keep refs in sync with props
  useEffect(() => {
    onImpressionRef.current = onImpression;
    onErrorRef.current = onError;
  }, [onImpression, onError]);

  // Keep adRef in sync with ad state
  useEffect(() => {
    adRef.current = ad;
  }, [ad]);

  const { isBot } = useBotDetection();

  // Detect when HTML content images have finished loading
  const hookEnabled = !!ad?.html && isLoading;
  const { isLoaded: assetsLoaded } = useAssetLoadDetection(htmlContentRef, hookEnabled);

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
        const finalWidth = (width == null || width === 0 || width === 1) ? Math.max(measuredW, 130) : measuredW;
        setMeasuredWidth(finalWidth);
        resizeObserver.disconnect();
      }
    });

    resizeObserver.observe(elementRef.current);
    return () => resizeObserver.disconnect();
  }, [width, measuredWidth]);

  // Listen for height messages from iframe
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

  // Mark HTML as loaded when assets (images) have finished loading
  useEffect(() => {
    if (ad?.html && assetsLoaded) {
      setIsLoaded(true);
      setIsLoading(false);
    }
  }, [ad?.html, assetsLoaded]);

  // Viewability and impression tracking (using refs, no re-renders)
  useEffect(() => {
    if (!ad || !elementRef.current || isBot || !adIdRef.current || impressionTrackedRef.current) return;

    const threshold = 0.5;
    const durationMs = 1000; // 1 second for MRC compliance
    const currentAdId = adIdRef.current;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const viewable = entry.intersectionRatio >= threshold;
        const now = Date.now();
        
        if (viewable) {
          if (viewableStartTimeRef.current === null) {
            viewableStartTimeRef.current = now;
          }
        } else {
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

    // Check periodically for duration
    const intervalId = setInterval(() => {
      if (viewableStartTimeRef.current !== null && !hasMetDurationRef.current) {
        const elapsed = Date.now() - viewableStartTimeRef.current;
        if (elapsed >= durationMs) {
          hasMetDurationRef.current = true;
          if (!impressionTrackedRef.current && currentAdId) {
            impressionTrackedRef.current = true;
            trackImpression(currentAdId, apiKey);
            // Use ref to get current ad value (avoid stale closure)
            const currentAd = adRef.current;
            if (currentAd && onImpressionRef.current) {
              onImpressionRef.current(currentAd);
            }
          }
        }
      }
    }, 100);

    return () => {
      observer.disconnect();
      clearInterval(intervalId);
    };
  }, [ad, isBot, apiKey]);

  // Viewport entry/exit tracking (using refs, no re-renders)
  useEffect(() => {
    if (!ad || !elementRef.current || isBot || !adIdRef.current) return;

    const currentAdId = adIdRef.current;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const inViewport = entry.intersectionRatio > 0;
        
        if (inViewport && !wasInViewportRef.current) {
          wasInViewportRef.current = true;
          trackViewportEntry(currentAdId, apiKey);
        } else if (!inViewport && wasInViewportRef.current) {
          wasInViewportRef.current = false;
          trackViewportExit(currentAdId, apiKey);
        }
      },
      { 
        threshold: 0,
        rootMargin: '0px'
      }
    );

    observer.observe(elementRef.current);

    return () => {
      observer.disconnect();
    };
  }, [ad, isBot, apiKey]);

  // Track viewport exit on unmount
  useEffect(() => {
    return () => {
      if (adIdRef.current && wasInViewportRef.current) {
        trackViewportExit(adIdRef.current, apiKey);
      }
    };
  }, [apiKey]);

  // Fetch ad once
  useEffect(() => {
    if (hasFetchedRef.current || !sessionId || error || ad) return;

    // Check cache first
    const cachedAd = getCachedAd(slot, position);
    if (cachedAd) {
      adIdRef.current = cachedAd.id;
      setAd(cachedAd);
      hasFetchedRef.current = true;
      return;
    }

    // Check no-fill
    if (hasNoFill(slot, position)) {
      if (!errorHandledRef.current) {
        errorHandledRef.current = true;
        setError('No ad available');
        const error = new Error('No ad available');
        if (onErrorRef.current) {
          onErrorRef.current(error);
        }
      }
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
    // Reset error handling flag for new fetch attempt
    errorHandledRef.current = false;

    // Calculate width using parsed width
    const parsedWidth = parseWidth(width);
    let widthValue: number | undefined;
    
    if (parsedWidth.type === 'fill') {
      widthValue = measuredWidth !== null ? Math.max(measuredWidth, 130) : undefined;
    } else if (parsedWidth.type === 'percentage' && parsedWidth.value !== undefined) {
      widthValue = measuredWidth !== null ? Math.max(Math.round(measuredWidth * parsedWidth.value), 130) : undefined;
    } else if (parsedWidth.type === 'pixels' && parsedWidth.value !== undefined) {
      widthValue = Math.max(Math.round(parsedWidth.value), 130);
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
        if (!errorHandledRef.current) {
          errorHandledRef.current = true;
          setError(result.error);
          markNoFill(slot, position);
          const error = new Error(result.error);
          if (onErrorRef.current) {
            onErrorRef.current(error);
          }
        }
      } else if (result.ad) {
        errorHandledRef.current = false;
        adIdRef.current = result.ad.id;
        setAd(result.ad);
        cacheAd(slot, position, result.ad);
        setIsLoading(true);
        setIsLoaded(false);
      } else {
        if (!errorHandledRef.current) {
          errorHandledRef.current = true;
          setError('No ad available');
          markNoFill(slot, position);
          const error = new Error('No ad available');
          if (onErrorRef.current) {
            onErrorRef.current(error);
          }
        }
      }
    }).catch(err => {
      if (!errorHandledRef.current) {
        errorHandledRef.current = true;
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch ad';
        setError(errorMessage);
        const error = new Error(errorMessage);
        if (onErrorRef.current) {
          onErrorRef.current(error);
        }
      }
    });
  }, [sessionId, slot, position, context, width, measuredWidth, error, ad, apiKey, isBot, hasPrivacyConsent, onError, getCachedAd, cacheAd, hasNoFill, markNoFill]);

  // Calculate container dimensions (memoized, no re-renders)
  const containerWidth = useMemo(() => {
    const parsedWidth = parseWidth(width);
    
    if (parsedWidth.type === 'fill') {
      return '100%';
    } else if (parsedWidth.type === 'percentage' && parsedWidth.value !== undefined) {
      return `${parsedWidth.value * 100}%`;
    } else if (parsedWidth.type === 'pixels' && parsedWidth.value !== undefined) {
      return `${Math.max(Math.round(parsedWidth.value), 130)}px`;
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
          minWidth: '130px',
          height: '0px',
          overflow: 'hidden',
        }}
      />
    );
  }

  // Helper to render the loading component
  const renderLoader = () => {
    // null = explicitly disabled
    if (LoadingComponent === null) return null;
    // Custom component provided
    if (LoadingComponent) return <LoadingComponent />;
    // Default spinner
    return <RadialLinesSpinner />;
  };

  // Render HTML directly
  if (ad.html) {
    return (
      <div
        ref={elementRef}
        className="simula-native-banner"
        style={{
          display: 'block',
          width: containerWidth,
          minWidth: '130px',
          height: isLoaded ? 'fit-content' : 'auto',
          minHeight: isLoading ? '60px' : undefined,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Loading overlay */}
        {isLoading && LoadingComponent !== null && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'transparent',
              zIndex: 2,
              opacity: isLoaded ? 0 : 1,
              transition: 'opacity 0.3s ease-out',
              pointerEvents: 'none',
            }}
          >
            {renderLoader()}
          </div>
        )}

        {/* Ad content with fade-in animation */}
        <div
          ref={htmlContentRef}
          className="simula-native-banner-html"
          dangerouslySetInnerHTML={{ __html: ad.html }}
          style={{
            display: 'block',
            width: '100%',
            height: 'fit-content',
            opacity: isLoaded ? 1 : 0,
            visibility: isLoaded ? 'visible' : 'hidden',
            transition: 'opacity 0.4s ease-out',
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
        minWidth: '130px',
        height: containerHeight,
        minHeight: isLoading ? '60px' : undefined,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Loading overlay */}
      {isLoading && LoadingComponent !== null && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'transparent',
            zIndex: 2,
            opacity: isLoaded ? 0 : 1,
            transition: 'opacity 0.3s ease-out',
            pointerEvents: 'none',
          }}
        >
          {renderLoader()}
        </div>
      )}
      
      {/* Iframe with fade-in animation */}
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
          opacity: isLoaded ? 1 : 0,
          visibility: isLoaded ? 'visible' : 'hidden',
          transition: 'opacity 0.4s ease-out',
        }}
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        title={`Native Banner: ${ad.id}`}
        onLoad={() => {
          setTimeout(() => {
            setIsLoaded(true);
            setIsLoading(false);
          }, 50);
        }}
      />
    </div>
  );
});

NativeBanner.displayName = 'NativeBanner';
