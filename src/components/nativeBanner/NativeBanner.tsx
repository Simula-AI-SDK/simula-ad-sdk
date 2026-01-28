import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSimula } from '../../SimulaProvider';
import { useBotDetection } from '../../hooks/useBotDetection';
import { useViewability } from '../../hooks/useViewability';
import { fetchNativeBannerAd, trackImpression, trackViewportEntry, trackViewportExit } from '../../utils/api';
import { validateNativeBannerProps } from '../../utils/validation';
import { NativeBannerProps, AdData, filterContextForPrivacy } from '../../types';

// Internal constant to prevent API abuse
const MIN_FETCH_INTERVAL_MS = 1000; // 1 second minimum between fetches

// Radial lines spinner component (matching Flutter SDK)
const RadialLinesSpinner: React.FC = () => {
    const [progress, setProgress] = useState(0);
  
    useEffect(() => {
      const interval = setInterval(() => {
        setProgress((prev) => (prev + 1 / 12) % 1);
      }, 100); // 1200ms / 12 lines = 100ms per line
      return () => clearInterval(interval);
    }, []);
  
    const lineCount = 12;
    const radius = 8;
    const lineLength = radius * 0.6;
    const currentLine = Math.floor(progress * lineCount) % lineCount;
  
    return (
      <svg width="16" height="16" viewBox="0 0 16 16">
        {Array.from({ length: lineCount }).map((_, i) => {
          const angle = (i * 2 * Math.PI) / lineCount;
          const distance = (i - currentLine + lineCount) % lineCount;
          
          let opacity = 0.35;
          if (distance === 0) opacity = 1.0;
          else if (distance === 1) opacity = 0.75;
          else if (distance === 2) opacity = 0.5;
          else if (distance === 3) opacity = 0.4;
  
          const startX = 8 + (radius - lineLength) * Math.cos(angle);
          const startY = 8 + (radius - lineLength) * Math.sin(angle);
          const endX = 8 + radius * Math.cos(angle);
          const endY = 8 + radius * Math.sin(angle);
  
          return (
            <line
              key={i}
              x1={startX}
              y1={startY}
              x2={endX}
              y2={endY}
              stroke="black" // white
              strokeWidth="1.5"
              strokeLinecap="round"
              opacity={opacity}
            />
          );
        })}
      </svg>
    );
  };

// Helper functions for dimension validation
// Width < 1 is percentage (e.g., 0.8 = 80%), > 1 is pixels (e.g., 400.0 = 400px)
// null, undefined, 0, or 1 means fill container (min 200px)
const isPercentageWidth = (width: number | null | undefined): boolean => width != null && width > 0 && width < 1;
const isPixelWidth = (width: number | null | undefined): boolean => width != null && width > 1;
const needsWidthMeasurement = (width: number | null | undefined): boolean => width == null || width === 0 || width === 1 || isPercentageWidth(width);

export const NativeBanner: React.FC<NativeBannerProps> = (props) => {
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
    getCachedHeight,
    cacheHeight,
    hasNoFill,
    markNoFill,
  } = useSimula();

  const [ad, setAd] = useState<AdData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showInfoModal, setShowInfoModal] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);
  const [measuredHeight, setMeasuredHeight] = useState<number | null>(null);
  const [preservedWidth, setPreservedWidth] = useState<number | null>(null);

  // Track if this component has already fetched an ad
  const [hasTriggered, setHasTriggered] = useState(false);
  
  // Track viewport visibility for entry/exit tracking
  const [isInViewport, setIsInViewport] = useState(false);
  const wasInViewportRef = useRef(false);

  const lastFetchTimeRef = useRef<number>(0);
  const adRef = useRef<AdData | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Keep adRef in sync with ad state
  useEffect(() => {
    adRef.current = ad;
  }, [ad]);

  const {
    elementRef,
    hasBeenViewed,
    isViewable,           // MRC-compliant (1 second duration)
    trackImpression: viewabilityTrackImpression
  } = useViewability({
    threshold: 0.5,
    durationMs: 1000, // 1 second for MRC compliance
    onImpressionTracked: (adId: string) => {
      // This gets called after impression tracking
      trackImpression(adId, apiKey);
      // Use ref to get current ad value (avoid stale closure)
      if (adRef.current) {
        onImpression?.(adRef.current);
      }
    }
  });

  const { isBot, reasons } = useBotDetection();

  // Listen for postMessage from iframe to get dynamic height
  // Only process messages from this component's own iframe to prevent cross-contamination
  useEffect(() => {
    // If ad has HTML, mark as loaded immediately (no iframe needed)
    if (ad?.html) {
      setIframeLoaded(true);
      return;
    }

    const handleMessage = (event: MessageEvent) => {
      // Only process messages if iframe ref is available
      if (!iframeRef.current?.contentWindow) {
        return;
      }
      
      // Only process messages from this component's iframe (the wrapper window)
      if (event.source !== iframeRef.current.contentWindow) {
        return;
      }
      
      // Only process AD_HEIGHT messages
      if (event.data?.type !== 'AD_HEIGHT') return;
      
      const newHeight = event.data.height;
      if (typeof newHeight !== 'number' || newHeight <= 0) return;
      
      console.log(`Received height from iframe with type ${event.data.type}: ${JSON.stringify(event.data)}`);
      setMeasuredHeight(newHeight);
      setIframeLoaded(true);
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [ad]);

  // Measure actual width once when element is ready (needed for null/0/1 or percentage widths)
  useEffect(() => {
    const needsMeasurement = needsWidthMeasurement(width);

    if (!needsMeasurement) return;
    if (!elementRef.current) return;

    let hasMeasured = false;

    const resizeObserver = new ResizeObserver(entries => {
      const entry = entries[0];
      if (entry && !hasMeasured) {
        hasMeasured = true;
        const measuredW = Math.round(entry.contentRect.width);
        // Ensure minimum 200px for null/undefined/0/1 width (fill container)
        const finalWidth = (width == null || width === 0 || width === 1) ? Math.max(measuredW, 200) : measuredW;
        setMeasuredWidth(finalWidth);
        resizeObserver.disconnect();
      }
    });

    resizeObserver.observe(elementRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [width, elementRef]);

  const fetchAdData = useCallback(async () => {
    // Never retry if there's an error - once failed, stay failed
    if (error) return;

    // If ad already exists, don't fetch again
    if (ad) return;

    // Prevent duplicate concurrent fetches
    if (loading || hasTriggered) return;

    // Check if we know there's no fill for this slot/position
    if (hasNoFill(slot, position)) {
      setError('No ad available');
      onError?.(new Error('No ad available'));
      return;
    }

    // Check for cached ad
    const cachedAd = getCachedAd(slot, position);
    if (cachedAd) {
      setAd(cachedAd);
      setHasTriggered(true);
      return;
    }

    // Block if sessionId is missing or invalid
    if (!sessionId) {
      return;
    }

    // Wait for width measurement when using null/0/1 (fill container) or percentage values (0 < width < 1)
    const needsMeasurement = needsWidthMeasurement(width);
    if (needsMeasurement && measuredWidth === null) {
      return;
    }

    // Block ad requests from detected bots
    if (isBot) {
      console.warn('[NativeBanner] Bot detected, blocking ad request:', { reasons });
      return;
    }

    const now = Date.now();
    if (now - lastFetchTimeRef.current < MIN_FETCH_INTERVAL_MS) {
      return;
    }

    setLoading(true);
    setError(null);
    lastFetchTimeRef.current = now;

    try {
      // Determine width value for API
      let widthValue: number | undefined;
      
      if (width == null || width === 0 || width === 1) {
        // null/undefined/0/1 width: use measured container width (min 200px)
        if (measuredWidth !== null) {
          widthValue = Math.max(measuredWidth, 200);
        }
      } else if (isPercentageWidth(width)) {
        // Percentage width (< 1): calculate from measured container width
        if (measuredWidth !== null) {
          widthValue = Math.max(Math.round(measuredWidth * width), 200);
        }
      } else if (isPixelWidth(width)) {
        // Pixel width (>= 1): use directly, enforce minimum 200px
        widthValue = Math.max(Math.round(width), 200);
      }

      // Preserve width once calculated
      if (widthValue && !preservedWidth) {
        setPreservedWidth(widthValue);
      }

      // Filter context for privacy
      const filteredContext = filterContextForPrivacy(context, hasPrivacyConsent);

      const result = await fetchNativeBannerAd({
        sessionId,
        slot,
        position,
        context: filteredContext,
        width: widthValue,
      });

      if (result.error) {
        console.warn('[NativeBanner] Ad fetch failed:', result.error);
        setError(result.error);
        markNoFill(slot, position);
        onError?.(new Error(result.error));
      } else if (result.ad) {
        setAd(result.ad);
        cacheAd(slot, position, result.ad);
        setHasTriggered(true);
      } else {
        console.warn('[NativeBanner] No ad returned from API - no fill or invalid response');
        setError('No ad available');
        markNoFill(slot, position);
        onError?.(new Error('No ad available'));
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch ad';
      setError(errorMessage);
      onError?.(new Error(errorMessage));
    } finally {
      setLoading(false);
    }
  }, [ad, error, loading, hasTriggered, apiKey, sessionId, slot, position, context, width, isBot, reasons, measuredWidth, preservedWidth, hasPrivacyConsent, onError, getCachedAd, cacheAd, hasNoFill, markNoFill]);

  // Trigger ad fetch when session becomes available
  useEffect(() => {
    if (sessionId && !hasTriggered && !error && !ad) {
      fetchAdData();
    }
  }, [sessionId, hasTriggered, error, ad, fetchAdData]);

  // Trigger ad fetch when conditions are met
  useEffect(() => {
    if (hasTriggered) return;
    if (!hasBeenViewed) return;
    const needsMeasurement = needsWidthMeasurement(width);
    // For null or percentage widths, wait for measurement
    if (needsMeasurement && measuredWidth === null) return;
    fetchAdData();
  }, [hasBeenViewed, hasTriggered, measuredWidth, width, fetchAdData]);

  // Track impression when ad is viewable, iframe loaded, and not a bot
  useEffect(() => {
    if (ad && isViewable && !isBot && iframeLoaded) {
      viewabilityTrackImpression(ad.id);
    }
  }, [ad, isViewable, isBot, iframeLoaded, viewabilityTrackImpression]);

  // Track viewport entry/exit
  useEffect(() => {
    if (!ad || isBot) return;
    
    const currentlyInViewport = hasBeenViewed && iframeLoaded;
    
    if (currentlyInViewport && !wasInViewportRef.current) {
      setIsInViewport(true);
      wasInViewportRef.current = true;
      trackViewportEntry(ad.id, apiKey);
    }
    
    if (!currentlyInViewport && wasInViewportRef.current && isInViewport) {
      setIsInViewport(false);
      wasInViewportRef.current = false;
      trackViewportExit(ad.id, apiKey);
    }
  }, [ad, hasBeenViewed, iframeLoaded, isBot, apiKey, isInViewport]);

  // Track viewport exit on unmount
  useEffect(() => {
    return () => {
      if (adRef.current && wasInViewportRef.current) {
        trackViewportExit(adRef.current.id, apiKey);
      }
    };
  }, [apiKey]);

  // Calculate container dimensions
  const containerWidth = useMemo(() => {
    if (width == null || width === 0 || width === 1) {
      // null/undefined/0/1: fill container width (min 200px)
      return '100%';
    } else if (isPercentageWidth(width)) {
      // Percentage (< 1): use as percentage
      return `${width * 100}%`;
    } else if (isPixelWidth(width)) {
      // Pixels (>= 1): use as pixels, enforce minimum 200px
      return `${Math.max(Math.round(width), 200)}px`;
    }
    // Fallback (shouldn't happen)
    return '100%';
  }, [width]);


  const renderContent = () => {
    if (error) {
      return null;
    }

    if (!ad || (!ad.iframeUrl && !ad.html)) {
      return null;
    }

    // Render HTML directly if available
    if (ad.html) {
      return (
        <div
          className="simula-native-banner-content"
          style={{
            position: 'relative',
            width: '100%',
            height: 'fit-content',
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
          {showInfoModal && (
            <div
              className="simula-native-banner-modal-overlay"
              onClick={() => setShowInfoModal(false)}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10000,
              }}
            >
              <div
                className="simula-native-banner-modal-content"
                onClick={(e) => e.stopPropagation()}
                style={{
                  backgroundColor: 'white',
                  borderRadius: '8px',
                  padding: '20px',
                  maxWidth: '300px',
                  textAlign: 'center',
                  position: 'relative',
                }}
              >
                <button
                  className="simula-native-banner-modal-close"
                  onClick={() => setShowInfoModal(false)}
                  aria-label="Close"
                  style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    width: '24px',
                    height: '24px',
                    padding: 0,
                    border: 'none',
                    background: 'none',
                    fontSize: '20px',
                    cursor: 'pointer',
                    color: '#666',
                  }}
                >
                  ×
                </button>
                <p style={{ margin: 0, color: '#333', fontSize: '14px' }}>
                  Powered by{' '}
                  <a
                    href="https://simula.ad"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#3b82f6', textDecoration: 'none' }}
                  >
                    Simula
                  </a>
                </p>
              </div>
            </div>
          )}
        </div>
      );
    }

    // Render iframe (legacy)
    return (
      <div
        className="simula-native-banner-content"
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
        }}
      >
        <iframe
          ref={iframeRef}
          src={ad.iframeUrl}
          className="simula-native-banner-frame"
          style={{
            display: 'block',
            verticalAlign: 'top',
            border: 0,
            margin: 0,
            padding: 0,
            width: '100%',
            height: measuredHeight ? `${measuredHeight}px` : '150px',
          }}
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          title={`Native Banner: ${ad.id}`}
          onLoad={() => {
            setIframeLoaded(true);
          }}
        />
        {!iframeLoaded && (
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
              zIndex: 1,
            }}
          >
            <RadialLinesSpinner />
          </div>
        )}
        {showInfoModal && (
          <div
            className="simula-native-banner-modal-overlay"
            onClick={() => setShowInfoModal(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10000,
            }}
          >
            <div
              className="simula-native-banner-modal-content"
              onClick={(e) => e.stopPropagation()}
              style={{
                backgroundColor: 'white',
                borderRadius: '8px',
                padding: '20px',
                maxWidth: '300px',
                textAlign: 'center',
                position: 'relative',
              }}
            >
              <button
                className="simula-native-banner-modal-close"
                onClick={() => setShowInfoModal(false)}
                aria-label="Close"
                style={{
                  position: 'absolute',
                  top: '8px',
                  right: '8px',
                  width: '24px',
                  height: '24px',
                  padding: 0,
                  border: 'none',
                  background: 'none',
                  fontSize: '20px',
                  cursor: 'pointer',
                  color: '#666',
                }}
              >
                ×
              </button>
              <p style={{ margin: 0, color: '#333', fontSize: '14px' }}>
                Powered by{' '}
                <a
                  href="https://simula.ad"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#3b82f6', textDecoration: 'none' }}
                >
                  Simula
                </a>
              </p>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Use fit-content for HTML rendering, measured height for iframe
  const containerHeight = useMemo(() => {
    if (!ad) return '0px';
    if (ad.html) {
      return 'fit-content';
    }
    return measuredHeight ? `${measuredHeight}px` : '200px';
  }, [ad, measuredHeight]);

  return (
    <div
      ref={elementRef}
      className="simula-native-banner"
      style={{
        display: error ? 'none' : 'block',
        width: containerWidth,
        minWidth: '200px', // Enforce minimum 200px for all width types
        height: containerHeight,
        overflow: 'hidden',
      }}
    >
      {renderContent()}
    </div>
  );
};
