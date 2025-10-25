import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useSimula } from './SimulaProvider';
import { useDebounce } from './hooks/useDebounce';
import { useBotDetection } from './hooks/useBotDetection';
import { useViewability } from './hooks/useViewability';
import { fetchAd, trackImpression } from './utils/api';
import { createAdSlotCSS } from './utils/styling';
import { validateAdSlotProps } from './utils/validation';
import { AdSlotProps, AdData } from './types';

// Internal constant to prevent API abuse
const MIN_FETCH_INTERVAL_MS = 1000; // 1 second minimum between fetches

// Helper functions for width validation
const isAutoWidth = (width: any): boolean => width === 'auto';
const isPercentageWidth = (width: any): boolean => typeof width === 'string' && /^\d+(?:\.\d+)?%$/.test(width);
const needsWidthMeasurement = (width: any): boolean => isAutoWidth(width) || isPercentageWidth(width);

// Validate messages array has actual content
const hasValidMessages = (messages: any[]): boolean => {
  return messages.length > 0 && messages.some(msg => msg && msg.content && msg.content.trim().length > 0);
};

export const AdSlot: React.FC<AdSlotProps> = (props) => {
  // Validate props early
  validateAdSlotProps(props);

  const {
    messages,
    trigger,
    formats: formatsRaw = ['all'],
    theme = {},
    debounceMs = 0,
    onImpression,
    onClick,
    onError,
  } = props;

  // Normalize formats to array (similar to theme.accent and theme.font)
  const formats = Array.isArray(formatsRaw) ? formatsRaw : [formatsRaw];

  const { apiKey, sessionId } = useSimula();

  // Generate a stable slotId for this component instance
  const slotId = useMemo(() => `slot-${uuidv4()}`, []);
  
  const [ad, setAd] = useState<AdData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shouldFetch, setShouldFetch] = useState(false);
  
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);

  // Track if this AdSlot has already been triggered
  const [hasTriggered, setHasTriggered] = useState(false);
  const [triggerUsed, setTriggerUsed] = useState<Promise<any> | null>(null);

  const lastFetchTimeRef = useRef<number>(0);
  const styleElementRef = useRef<HTMLStyleElement | null>(null);

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
      if (ad) {
        onImpression?.(ad);
      }
    }
  });

  const { isBot, reasons } = useBotDetection();

  // Measure actual width once when element is ready
  useEffect(() => {
    const currentWidth = theme.width;

    // If no width is configured at all, skip measurement
    if (currentWidth === undefined) return;

    // Only measure if it's 'auto' or a percentage value
    const needsMeasurement = needsWidthMeasurement(currentWidth);

    if (!needsMeasurement) return;
    if (!elementRef.current) return;

    // Track if already measured to prevent re-observation
    let hasMeasured = false;

    // Use ResizeObserver to get the initial size
    const resizeObserver = new ResizeObserver(entries => {
      const entry = entries[0];
      if (entry && !hasMeasured) {
        hasMeasured = true;
        const width = Math.round(entry.contentRect.width);
        setMeasuredWidth(width);
        console.log(`📏 AdSlot measured width: ${width}px (configured: ${currentWidth})`);

        // Disconnect after first measurement
        resizeObserver.disconnect();
      }
    });

    resizeObserver.observe(elementRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [theme.width, elementRef]);

  const fetchAdData = useCallback(async () => {
    if (!hasBeenViewed || loading || hasTriggered || error) {
      return;
    }

    // Wait for width measurement when using auto or percentage values
    const currentWidth = theme.width;
    const needsMeasurement = needsWidthMeasurement(currentWidth);

    if (needsMeasurement && measuredWidth === null) {
      return;
    }

    // Block ad requests from detected bots
    if (isBot) {
      console.warn('Bot detected, blocking ad request:', { reasons });
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
      // Validate width before making API call
      const currentConfiguredWidth = theme.width;
      const minWidth = 320;

      // Check width bounds (numeric or px string)
      let widthValue: number | null = null;
      if (typeof currentConfiguredWidth === 'number') {
        widthValue = currentConfiguredWidth;
      } else if (typeof currentConfiguredWidth === 'string') {
        const pxMatch = currentConfiguredWidth.match(/^(\d+(?:\.\d+)?)px$/);
        if (pxMatch) {
          widthValue = parseFloat(pxMatch[1]);
        }
      }

      // Validate minimum width if we have a concrete value
      if (widthValue !== null && widthValue < minWidth) {
        console.error(`AdSlot width ${widthValue}px is below minimum ${minWidth}px. Skipping ad request.`);
        setError(`Invalid width: ${widthValue}px (minimum: ${minWidth}px)`);
        setLoading(false);
        return;
      }

      // Create theme with measured width for backend
      const themeForBackend = { ...theme };

      // Convert the current width to pixels for backend - always send as 'width'
      if (typeof currentConfiguredWidth === "string") {
        // Check if it's a px string like "400px"
        const pxMatch = currentConfiguredWidth.match(/^(\d+(?:\.\d+)?)px$/);
        if (pxMatch) {
          // Convert "400px" to 400
          themeForBackend.width = parseFloat(pxMatch[1]);
          console.log(`🎯 Converting ${currentConfiguredWidth} to ${themeForBackend.width}px for backend`);
        } else if (measuredWidth !== null) {
          // For 'auto' and percentages, use measured width
          // If measured width is below minimum, use minimum
          const finalWidth = measuredWidth < minWidth ? minWidth : measuredWidth;
          themeForBackend.width = finalWidth;
          console.log(`🎯 Sending width to backend: ${finalWidth}px (measured: ${measuredWidth}px, configured: ${currentConfiguredWidth})`);
        }
      } else if (typeof currentConfiguredWidth === "number") {
        // Already a number, just use it
        themeForBackend.width = currentConfiguredWidth;
      }

      const result = await fetchAd({
        messages,
        formats,
        apiKey,
        slotId,
        theme: themeForBackend,
        sessionId,
      });

      if (result.error) {
        console.warn('🚫 Ad fetch failed:', result.error);
        setError(result.error);
        onError?.(new Error(result.error));
      } else if (result.ad) {
        console.log('✅ Ad fetched successfully:', { adId: result.ad.id, format: result.ad.format });
        setAd(result.ad);
        // Mark as triggered - this AdSlot will never fetch again
        setHasTriggered(true);
      } else {
        console.warn('🚫 No ad returned from API - no fill or invalid response');
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
  }, [hasBeenViewed, loading, hasTriggered, error, messages, formats, apiKey, slotId, theme, onError, isBot, reasons, sessionId, measuredWidth]);

  useDebounce(
    () => {
      if (shouldFetch) {
        fetchAdData();
        setShouldFetch(false);
      }
    },
    debounceMs,
    [shouldFetch, fetchAdData]
  );

  // Handle trigger promise resolution/rejection
  useEffect(() => {
    if (hasTriggered) return;
    if (!trigger) return;
    if (trigger === triggerUsed) return;

    setTriggerUsed(trigger);

    trigger
      .then(() => {
        if (!hasTriggered) {
          setShouldFetch(true);
        }
      })
      .catch(() => {
        if (!hasTriggered) {
          setShouldFetch(true);
        }
      });
  }, [trigger, triggerUsed, hasTriggered]);

  // Consolidated trigger logic - checks all conditions before fetching
  useEffect(() => {
    // Don't trigger if already triggered
    if (hasTriggered) return;

    // Don't trigger if no valid messages
    if (!hasValidMessages(messages)) return;

    // Don't trigger if waiting for trigger promise
    if (trigger && !triggerUsed) return;

    // Don't trigger if not viewed yet
    if (!hasBeenViewed) return;

    // Don't trigger if waiting for width measurement
    const needsMeasurement = typeof theme.width === "string" && needsWidthMeasurement(theme.width);
    if (needsMeasurement && measuredWidth === null) return;

    // All conditions met, trigger fetch
    setShouldFetch(true);
  }, [hasBeenViewed, hasTriggered, triggerUsed, trigger, measuredWidth, theme.width, messages]);

  useEffect(() => {
    if (ad && isViewable && !isBot && iframeLoaded) {
      viewabilityTrackImpression(ad.id); // Track impression when viewable AND iframe loaded
    }
  }, [ad, isViewable, isBot, iframeLoaded, viewabilityTrackImpression]);

  useEffect(() => {
    // Create style element once on mount
    if (!styleElementRef.current) {
      styleElementRef.current = document.createElement('style');
      styleElementRef.current.setAttribute('data-simula-styles', 'true');
      document.head.appendChild(styleElementRef.current);
    }

    // Update CSS content whenever theme changes
    const css = createAdSlotCSS(theme);
    styleElementRef.current.textContent = css;

    // Cleanup only on unmount
    return () => {
      if (styleElementRef.current && document.head.contains(styleElementRef.current)) {
        document.head.removeChild(styleElementRef.current);
        styleElementRef.current = null;
      }
    };
  }, [theme]);


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
        className="simula-content-slot"
        onClick={() => onClick?.(ad)}
        style={{ cursor: onClick ? 'pointer' : 'default' }}
      >
          <iframe
            src={ad.iframeUrl}
            className="simula-content-frame"
            style={{ display: 'block', verticalAlign: 'top', border: 0, margin: 0, padding: 0, width: '100%' }}
            frameBorder="0"
            scrolling="no"
            allowTransparency={true}
            sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
            title={`Content: ${ad.id}`}
            onLoad={() => {
              // Iframe loaded - now impressions can be tracked
              setIframeLoaded(true);
            }}
        />
        <button
          className="simula-info-icon"
          onClick={(e) => {
            e.stopPropagation();
            setShowInfoModal(true);
          }}
          aria-label="Content information"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1" fill="none"/>
            <text x="8" y="12" textAnchor="middle" fontSize="10" fontFamily="serif">i</text>
          </svg>
        </button>
        {showInfoModal && (
          <div className="simula-modal-overlay" onClick={() => setShowInfoModal(false)}>
            <div className="simula-modal-content" onClick={(e) => e.stopPropagation()}>
              <button 
                className="simula-modal-close"
                onClick={() => setShowInfoModal(false)}
                aria-label="Close"
              >
                ×
              </button>
              <p>
                Powered by{' '}
                <a
                  href="https://simula.ad"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="simula-modal-link"
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
      style={{
        minWidth: error ? '0px' : (ad && ad.id ? '320px' : '0px'),
        width: error ? '0px' : (ad && ad.id ? (!theme.width || theme.width === 'auto' ? '100%' : theme.width) : '0px'),
        height: error ? '0px' : (ad && ad.id ? '265px' : '0px'),
        overflow: 'hidden'
      }}
    >
      {renderContent()}
    </div>
  );
};