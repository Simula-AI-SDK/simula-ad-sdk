import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  const { apiKey, devMode } = useSimula();
  const [ad, setAd] = useState<AdData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shouldFetch, setShouldFetch] = useState(false);

  const lastFetchTimeRef = useRef<number>(0);
  const triggerPromiseRef = useRef<Promise<any> | null>(null);
  const styleElementRef = useRef<HTMLStyleElement | null>(null);

  const { elementRef, isViewable, hasBeenViewed, impressionTracked, trackImpression: viewabilityTrackImpression } = useViewability({
    threshold: 0.5,
    onImpressionTracked: (adId: string) => {
      // This gets called after impression tracking
      trackImpression(adId, apiKey, devMode);
      if (ad) {
        onImpression?.(ad);
      }
    }
  });

  const { isBot, reasons } = useBotDetection();

  const canFetch = !onlyWhenVisible || hasBeenViewed;

  const fetchAdData = useCallback(async () => {
    if (!canFetch || loading) return;

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
      const result = await fetchAd({
        messages,
        formats,
        apiKey,
        slotId,
        theme,
        devMode,
      });

      if (result.error) {
        setError(result.error);
        onError?.(new Error(result.error));
      } else if (result.ad) {
        setAd(result.ad);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch ad';
      setError(errorMessage);
      onError?.(new Error(errorMessage));
    } finally {
      setLoading(false);
    }
  }, [canFetch, loading, minIntervalMs, messages, formats, apiKey, slotId, theme, devMode, onError, isBot, reasons]);

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
    if (trigger && trigger !== triggerPromiseRef.current) {
      triggerPromiseRef.current = trigger;

      trigger
        .then(() => {
          setShouldFetch(true);
        })
        .catch(() => {
          setShouldFetch(true);
        });
    }
  }, [trigger]);

  useEffect(() => {
    if (ad && isViewable && !isBot) {
      viewabilityTrackImpression(ad.id); // Track impression when viewable
    }
  }, [ad, isViewable, isBot, viewabilityTrackImpression]);

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

      if (ad.clickUrl) {
        window.open(ad.clickUrl, '_blank', 'noopener,noreferrer');
      }
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
        <span className="simula-ad-label">Sponsored</span>
          <iframe
            src={ad.iframeUrl}
            className="simula-ad-iframe"
            frameBorder="0"
            scrolling="no"
            allowTransparency={true}
            sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
            title={`Ad: ${ad.id}`}
            onLoad={() => {
            // Iframe loaded - no impression tracking here
            // Impression tracking is handled by viewability detection
          }}
        />
      </div>
    );
  };

  return <div ref={elementRef}>{renderContent()}</div>;
};