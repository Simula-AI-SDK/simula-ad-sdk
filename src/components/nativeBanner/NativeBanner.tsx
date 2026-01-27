import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSimula } from '../../SimulaProvider';
import { useBotDetection } from '../../hooks/useBotDetection';
import { useViewability } from '../../hooks/useViewability';
import { fetchNativeBannerAd, trackImpression, trackViewportEntry, trackViewportExit } from '../../utils/api';
import { validateNativeBannerProps } from '../../utils/validation';
import { NativeBannerProps, AdData, filterContextForPrivacy } from '../../types';

// Internal constant to prevent API abuse
const MIN_FETCH_INTERVAL_MS = 1000; // 1 second minimum between fetches

// Helper functions for dimension validation
const isAutoDimension = (dim: any): boolean => dim === 'auto';
const isPercentageDimension = (dim: any): boolean => dim === '100%';
const needsWidthMeasurement = (width: any): boolean => isAutoDimension(width) || isPercentageDimension(width);

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
            stroke="white"
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity={opacity}
          />
        );
      })}
    </svg>
  );
};

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
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      try {
        const data = event.data;
        if (data && data.type === 'AD_HEIGHT' && typeof data.height === 'number') {
          // Add a small buffer (10px) to prevent cut-off
          const heightWithBuffer = data.height + 10;
          
          // Cache the height in the provider
          cacheHeight(slot, position, heightWithBuffer);
          
          setMeasuredHeight(heightWithBuffer);
          setIframeLoaded(true);
        }
      } catch (e) {
        // Silently ignore parsing errors
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [slot, position, cacheHeight]);

  // Measure actual width once when element is ready
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
        setMeasuredWidth(measuredW);
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
    const cachedHeight = getCachedHeight(slot, position);
    if (cachedAd) {
      setAd(cachedAd);
      setHasTriggered(true);
      if (cachedHeight) {
        setMeasuredHeight(cachedHeight);
        setIframeLoaded(true);
      }
      return;
    }

    // Block if sessionId is missing or invalid
    if (!sessionId) {
      // Session not ready yet - will retry when sessionId becomes available
      return;
    }

    // Wait for width measurement when using auto or percentage values
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
      if (typeof width === 'number') {
        widthValue = width;
      } else if (needsMeasurement && measuredWidth !== null) {
        widthValue = measuredWidth;
      }

      // Preserve width once calculated
      if (widthValue && !preservedWidth) {
        setPreservedWidth(widthValue);
      }

      // Filter context for privacy
      const filteredContext = filterContextForPrivacy(context, hasPrivacyConsent);

      const result = await fetchNativeBannerAd({
        apiKey,
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
  }, [ad, error, loading, hasTriggered, apiKey, sessionId, slot, position, context, width, isBot, reasons, measuredWidth, preservedWidth, hasPrivacyConsent, onError, getCachedAd, getCachedHeight, cacheAd, hasNoFill, markNoFill]);

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
    // Use preserved width if available
    if (preservedWidth) {
      return `${preservedWidth}px`;
    }
    if (width === 'auto' || width === '100%') {
      return '100%';
    }
    return typeof width === 'number' ? `${width}px` : width;
  }, [width, preservedWidth]);

  // Height is dynamic from postMessage, or small placeholder while waiting
  const containerHeight = useMemo(() => {
    if (!ad) {
      return '0px'; // No height until ad loads
    }
    if (measuredHeight) {
      return `${measuredHeight}px`;
    }
    return '50px'; // Small placeholder while waiting for height
  }, [ad, measuredHeight]);

  const renderContent = () => {
    if (error) {
      return null;
    }

    if (!ad || !ad.iframeUrl) {
      return null;
    }

    // Show loading spinner while waiting for height measurement
    if (!measuredHeight) {
      return (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '50px',
            backgroundColor: 'transparent',
          }}
        >
          <RadialLinesSpinner />
        </div>
      );
    }

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
            height: '100%',
          }}
          frameBorder="0"
          scrolling="no"
          allowTransparency={true}
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          title={`Native Banner: ${ad.id}`}
          onLoad={() => {
            // Try to inject script to listen for postMessage and forward to parent
            // Height will be received via postMessage from the iframe content
          }}
        />
        <button
          className="simula-native-banner-info-icon"
          onClick={(e) => {
            e.stopPropagation();
            setShowInfoModal(true);
          }}
          aria-label="Ad information"
          style={{
            position: 'absolute',
            top: '4px',
            right: '4px',
            width: '20px',
            height: '20px',
            padding: 0,
            border: 'none',
            borderRadius: '50%',
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            color: 'white',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            fontFamily: 'serif',
            opacity: 0.7,
            transition: 'opacity 0.2s',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1" fill="none"/>
            <text x="8" y="12" textAnchor="middle" fontSize="10" fontFamily="serif">i</text>
          </svg>
        </button>
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

  return (
    <div
      ref={elementRef}
      className="simula-native-banner"
      style={{
        display: error ? 'none' : 'block',
        width: containerWidth,
        height: containerHeight,
        overflow: 'hidden',
      }}
    >
      {renderContent()}
    </div>
  );
};
