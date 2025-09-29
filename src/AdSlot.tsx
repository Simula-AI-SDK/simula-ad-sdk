import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useSimula } from './SimulaProvider';
import { useDebounce } from './hooks/useDebounce';
import { useBotDetection } from './hooks/useBotDetection';
import { useViewability } from './hooks/useViewability';
import { fetchAd, trackImpression } from './utils/api';
import { createAdSlotCSS } from './utils/styling';
import { AdSlotProps, AdData } from './types';

export const AdSlot: React.FC<AdSlotProps> = ({
  messages,
  trigger,
  formats = ['all'],
  theme = {},
  slotId,
  debounceMs = 0,
  minIntervalMs = 1000,
  onlyWhenVisible = true,
  onImpression,
  onClick,
  onError,
}) => {
  const { apiKey, sessionId } = useSimula();
  
  // Generate a stable slotId for this component instance if not provided
  const resolvedSlotId = useMemo(() => slotId || `slot-${uuidv4()}`, [slotId]);
  
  const [ad, setAd] = useState<AdData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shouldFetch, setShouldFetch] = useState(false);
  
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [isWidthValid, setIsWidthValid] = useState(true);
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
    isInstantViewable,    // Instant viewability for fetching
    impressionTracked, 
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

  // Allow fetching if onlyWhenVisible is false, OR if the AdSlot container has been viewed
  // Now that we fixed the 0x0 container issue, viewability detection should work properly
  const canFetch = !onlyWhenVisible || hasBeenViewed;
  

  // Validate width from theme, default to 800px if not specified
  useEffect(() => {
    // Skip validation for string widths (auto, percentages, etc.) - they're responsive and will be handled by CSS
    if (typeof theme.width === "string") {
      setIsWidthValid(true);
      return;
    }
    
    const minWidth = 400;
    const maxWidth = 862;
    const effectiveWidth = typeof theme.width === 'number' ? theme.width : 800;
    
    if (effectiveWidth < minWidth) {
      setIsWidthValid(false);
      console.error(`AdSlot width ${effectiveWidth}px is below minimum ${minWidth}px. Skipping ad request.`);
    } else if (effectiveWidth > maxWidth) {
      setIsWidthValid(false);
      console.error(`AdSlot width ${effectiveWidth}px exceeds maximum ${maxWidth}px. Skipping ad request.`);
    } else {
      setIsWidthValid(true);
    }
  }, [theme.width]);

  // Measure actual width when using string values (auto, percentages, etc.)
  useEffect(() => {
    if ((typeof theme.width !== "string" && typeof theme.mobileWidth !== "string") || !elementRef.current) return;

    const resizeObserver = new ResizeObserver(entries => {
      const entry = entries[0];
      if (entry) {
        const width = Math.round(entry.contentRect.width);
        setMeasuredWidth(width);
        console.log(`📏 AdSlot measured width: ${width}px (theme.width: ${theme.width}, theme.mobileWidth: ${theme.mobileWidth})`);
      }
    });

    resizeObserver.observe(elementRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [theme.width, theme.mobileWidth, elementRef]);

  const fetchAdData = useCallback(async () => {
    if (!canFetch || loading || hasTriggered) {
      return;
    }
    if (!isWidthValid) {
      return;
    }

    // Wait for width measurement when using string values (auto, percentages, etc.)
    if ((typeof theme.width === "string" || typeof theme.mobileWidth === "string") && measuredWidth === null) {
      return;
    }

    // Block ad requests from detected bots
    if (isBot) {
      console.warn('Bot detected, blocking ad request:', { reasons });
      return;
    }

    const now = Date.now();
    if (now - lastFetchTimeRef.current < minIntervalMs) {
      return;
    }

    setLoading(true);
    setError(null);
    lastFetchTimeRef.current = now;

    try {
      // Create theme with measured width for backend
      const themeForBackend = { ...theme };
      if (typeof theme.width === "string" && measuredWidth !== null) {
        themeForBackend.width = measuredWidth;
        console.log(`🎯 Sending measured width to backend: ${measuredWidth}px (was: ${theme.width})`);
      }
      if (typeof theme.mobileWidth === "string" && measuredWidth !== null) {
        themeForBackend.mobileWidth = measuredWidth;
      }

      const result = await fetchAd({
        messages,
        formats,
        apiKey,
        slotId: resolvedSlotId,
        theme: themeForBackend,
        sessionId,
      });

      if (result.error) {
        setError(result.error);
        onError?.(new Error(result.error));
      } else if (result.ad) {
        setAd(result.ad);
        // Mark as triggered - this AdSlot will never fetch again
        setHasTriggered(true);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch ad';
      setError(errorMessage);
      onError?.(new Error(errorMessage));
    } finally {
      setLoading(false);
    }
  }, [canFetch, loading, hasTriggered, isWidthValid, minIntervalMs, messages, formats, apiKey, resolvedSlotId, theme, onError, isBot, reasons, sessionId, measuredWidth]);

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

  useEffect(() => {
    if (hasTriggered) {
      return;
    }

    // If no trigger provided, fetch immediately when messages exist
    if (!trigger) {
      if (messages.length > 0) {
        setShouldFetch(true);
      }
      return;
    }

    // Only trigger if we haven't triggered before and this is a new/different trigger
    if (trigger !== triggerUsed) {
      setTriggerUsed(trigger);

      trigger
        .then(() => {
          // Only proceed if we still haven't triggered (avoid race conditions)
          if (!hasTriggered) {
            setShouldFetch(true);
          }
        })
        .catch(() => {
          // Even on error, attempt to fetch (some ads might still be relevant)
          if (!hasTriggered) {
            setShouldFetch(true);
          }
        });
    }
  }, [trigger, triggerUsed, hasTriggered, messages.length]);

  // Trigger fetch when viewability is detected (for onlyWhenVisible=true case)
  useEffect(() => {
    if (onlyWhenVisible && hasBeenViewed && !hasTriggered && (triggerUsed || !trigger)) {
      setShouldFetch(true);
    }
  }, [onlyWhenVisible, hasBeenViewed, hasTriggered, triggerUsed, trigger]);

  // Trigger fetch when width measurement becomes available
  useEffect(() => {
    if ((typeof theme.width === "string" || typeof theme.mobileWidth === "string") && measuredWidth !== null && !hasTriggered && (triggerUsed || !trigger)) {
      setShouldFetch(true);
    }
  }, [measuredWidth, theme.width, theme.mobileWidth, hasTriggered, triggerUsed, trigger]);

  useEffect(() => {
    if (ad && isViewable && !isBot && iframeLoaded) {
      viewabilityTrackImpression(ad.id); // Track impression when viewable AND iframe loaded
    }
  }, [ad, isViewable, isBot, iframeLoaded, viewabilityTrackImpression]);

  useEffect(() => {
    const css = createAdSlotCSS(theme);

    if (!styleElementRef.current) {
      styleElementRef.current = document.createElement('style');
      styleElementRef.current.setAttribute('data-simula-styles', 'true');
      document.head.appendChild(styleElementRef.current);
    }

    styleElementRef.current.textContent = css;

    return () => {
      if (styleElementRef.current && document.head.contains(styleElementRef.current)) {
        document.head.removeChild(styleElementRef.current);
        styleElementRef.current = null;
      }
    };
  }, [theme]);

  const handleAdClick = useCallback(() => {
    if (ad) {
      // trackClick(ad.id, apiKey);
      onClick?.(ad);
    }
  }, [ad, apiKey, onClick]);

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
      <div className="simula-ad-slot">
          <iframe
            src={ad.iframeUrl}
            className="simula-ad-iframe"
            style={{ display: 'block', verticalAlign: 'top', border: 0, margin: 0, padding: 0, width: '100%' }}
            frameBorder="0"
            scrolling="no"
            allowTransparency={true}
            sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
            title={`Ad: ${ad.id}`}
            onLoad={() => {
              // Iframe loaded - now impressions can be tracked
              setIframeLoaded(true);
            }}
        />
        <button 
          className="simula-info-icon"
          onClick={() => setShowInfoModal(true)}
          aria-label="Ad information"
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
                Ad powered by{' '}
                <a 
                  href="https://simula.ad" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="simula-modal-link"
                >
                  Simula
                </a>
                's AI-native ad platform.
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
        minWidth: '1px',
        minHeight: '1px',
        // Apply the actual expected dimensions so viewability works properly
        width: theme.width || 'auto',
        maxWidth: '896px', // 880px + 16px margin
        height: theme.width === 'auto' ? 'clamp(163px, 35.104vw, 241px)' : undefined
      }}
    >
      {renderContent()}
    </div>
  );
};