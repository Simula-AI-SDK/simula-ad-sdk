import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useSimula } from '../../SimulaProvider';
import { useBotDetection } from '../../hooks/useBotDetection';
import { useViewability } from '../../hooks/useViewability';
import { fetchNativeBannerAd, trackImpression } from '../../utils/api';
import { validateNativeBannerProps } from '../../utils/validation';
import { NativeBannerProps, AdData } from '../../types';

// Internal constant to prevent API abuse
const MIN_FETCH_INTERVAL_MS = 1000; // 1 second minimum between fetches

// Helper functions for dimension validation
const isAutoDimension = (dim: any): boolean => dim === 'auto';
const isPercentageDimension = (dim: any): boolean => dim === '100%';
const needsWidthMeasurement = (width: any): boolean => isAutoDimension(width) || isPercentageDimension(width);

export const NativeBanner: React.FC<NativeBannerProps> = (props) => {
  // Validate props early
  validateNativeBannerProps(props);

  const {
    width,
    height,
    position,
    context,
    onImpression,
    onClick,
    onError,
  } = props;

  const { apiKey, sessionId } = useSimula();

  // Generate a stable slotId for this component instance
  const slotId = useMemo(() => `native-banner-${uuidv4()}`, []);

  const [ad, setAd] = useState<AdData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showInfoModal, setShowInfoModal] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);

  // Track if this component has already fetched an ad
  const [hasTriggered, setHasTriggered] = useState(false);

  const lastFetchTimeRef = useRef<number>(0);
  const adRef = useRef<AdData | null>(null);

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

  // Measure actual width once when element is ready
  useEffect(() => {
    // Only measure if width is 'auto' or '100%'
    const needsMeasurement = needsWidthMeasurement(width);

    if (!needsMeasurement) return;
    if (!elementRef.current) return;

    // Track if already measured to prevent re-observation
    let hasMeasured = false;

    // Use ResizeObserver to get the initial size
    const resizeObserver = new ResizeObserver(entries => {
      const entry = entries[0];
      if (entry && !hasMeasured) {
        hasMeasured = true;
        const measuredW = Math.round(entry.contentRect.width);
        setMeasuredWidth(measuredW);

        // Disconnect after first measurement
        resizeObserver.disconnect();
      }
    });

    resizeObserver.observe(elementRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [width, elementRef]);

  const fetchAdData = useCallback(async () => {
    if (!hasBeenViewed || loading || hasTriggered || error) {
      return;
    }

    // Block if sessionId is missing or invalid
    if (!sessionId) {
      setError('Session invalid, fetch ad request blocked');
      console.error('[NativeBanner] Session invalid, fetch ad request blocked');
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

      // Determine height value for API
      let heightValue: number | undefined;
      if (typeof height === 'number') {
        heightValue = height;
      }
      // For 'auto' or '100%' height, we don't send a value and let the backend decide

      const result = await fetchNativeBannerAd({
        apiKey,
        sessionId,
        slotId,
        position,
        context,
        width: widthValue,
        height: heightValue,
      });

      if (result.error) {
        console.warn('[NativeBanner] Ad fetch failed:', result.error);
        setError(result.error);
        onError?.(new Error(result.error));
      } else if (result.ad) {
        setAd(result.ad);
        // Mark as triggered - this component will never fetch again
        setHasTriggered(true);
      } else {
        console.warn('[NativeBanner] No ad returned from API - no fill or invalid response');
        setError('No ad available');
        onError?.(new Error('No ad available'));
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch ad';
      setError(errorMessage);
      onError?.(new Error(errorMessage));
    } finally {
      setLoading(false);
    }
  }, [hasBeenViewed, loading, hasTriggered, error, apiKey, sessionId, slotId, position, context, width, height, isBot, reasons, measuredWidth, onError]);

  // Trigger ad fetch when conditions are met
  useEffect(() => {
    // Don't trigger if already triggered
    if (hasTriggered) return;

    // Don't trigger if not viewed yet
    if (!hasBeenViewed) return;

    // Don't trigger if waiting for width measurement
    const needsMeasurement = needsWidthMeasurement(width);
    if (needsMeasurement && measuredWidth === null) return;

    // All conditions met, trigger fetch
    fetchAdData();
  }, [hasBeenViewed, hasTriggered, measuredWidth, width, fetchAdData]);

  // Track impression when ad is viewable, iframe loaded, and not a bot
  useEffect(() => {
    if (ad && isViewable && !isBot && iframeLoaded) {
      viewabilityTrackImpression(ad.id);
    }
  }, [ad, isViewable, isBot, iframeLoaded, viewabilityTrackImpression]);

  // Calculate container dimensions
  const containerWidth = useMemo(() => {
    if (width === 'auto' || width === '100%') {
      return '100%';
    }
    return typeof width === 'number' ? `${width}px` : width;
  }, [width]);

  const containerHeight = useMemo(() => {
    if (!ad) {
      return '0px'; // No height until ad loads
    }
    if (height === 'auto') {
      // For auto height, use a default that allows the iframe content to determine its size
      // The iframe will resize based on its content
      return 'auto';
    }
    if (height === '100%') {
      return '100%';
    }
    return typeof height === 'number' ? `${height}px` : height;
  }, [ad, height]);

  // For auto height, we need the iframe to have some minimum height
  // The actual height will be determined by the ad content
  const iframeHeight = useMemo(() => {
    if (height === 'auto') {
      return '250px'; // Default minimum height for auto; ad content may resize
    }
    return '100%';
  }, [height]);

  const renderContent = () => {
    if (loading) {
      return null;
    }

    if (error) {
      return null;
    }

    if (!ad || !ad.iframeUrl) {
      return null;
    }

    return (
      <div
        className="simula-native-banner-content"
        onClick={() => onClick?.(ad)}
        style={{
          cursor: onClick ? 'pointer' : 'default',
          position: 'relative',
          width: '100%',
          height: height === 'auto' ? 'auto' : '100%',
        }}
      >
        <iframe
          src={ad.iframeUrl}
          className="simula-native-banner-frame"
          style={{
            display: 'block',
            verticalAlign: 'top',
            border: 0,
            margin: 0,
            padding: 0,
            width: '100%',
            height: iframeHeight,
          }}
          frameBorder="0"
          scrolling="no"
          allowTransparency={true}
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          title={`Native Banner: ${ad.id}`}
          onLoad={() => {
            setIframeLoaded(true);
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
