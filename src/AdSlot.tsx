import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSimula } from './SimulaProvider';
import { useIntersectionObserver } from './hooks/useIntersectionObserver';
import { useDebounce } from './hooks/useDebounce';
import { fetchAd, trackImpression, trackClick } from './utils/api';
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
  const { apiKey } = useSimula();
  const [ad, setAd] = useState<AdData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shouldFetch, setShouldFetch] = useState(false);
  const [hasTrackedImpression, setHasTrackedImpression] = useState(false);

  const lastFetchTimeRef = useRef<number>(0);
  const triggerPromiseRef = useRef<Promise<any> | null>(null);
  const styleElementRef = useRef<HTMLStyleElement | null>(null);

  const { elementRef, isIntersecting, hasIntersected } = useIntersectionObserver({
    threshold: 0.5,
  });

  const canFetch = !onlyWhenVisible || hasIntersected;

  const fetchAdData = useCallback(async () => {
    if (!canFetch || loading) return;

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
      });

      if (result.error) {
        setError(result.error);
        onError?.(new Error(result.error));
      } else if (result.ad) {
        setAd(result.ad);
        setHasTrackedImpression(false);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch ad';
      setError(errorMessage);
      onError?.(new Error(errorMessage));
    } finally {
      setLoading(false);
    }
  }, [canFetch, loading, minIntervalMs, messages, formats, apiKey, slotId, onError]);

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
    if (ad && isIntersecting && !hasTrackedImpression) {
      setHasTrackedImpression(true);
      trackImpression(ad.id, apiKey);
      onImpression?.(ad);
    }
  }, [ad, isIntersecting, hasTrackedImpression, apiKey, onImpression]);

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
      trackClick(ad.id, apiKey);
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

    if (!ad) {
      return null;
    }

    return (
      <div className="simula-ad-slot">
        <span className="simula-ad-label">Sponsored</span>
        {ad.iframeUrl ? (
          <iframe
            src={ad.iframeUrl}
            className="simula-ad-iframe"
            frameBorder="0"
            scrolling="no"
            allowTransparency={true}
            sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
            title={`Ad: ${ad.id}`}
            onLoad={() => {
              // Track impression when iframe loads
              if (!hasTrackedImpression && isIntersecting) {
                setHasTrackedImpression(true);
                trackImpression(ad.id, apiKey);
                onImpression?.(ad);
              }
            }}
          />
        ) : (
          <div className="simula-ad-content" onClick={handleAdClick}>
            {ad.format === 'text' && (
              <>
                <div className="simula-ad-title">Recommended for you</div>
                <div className="simula-ad-description">{ad.content}</div>
                <span className="simula-ad-cta">Learn More</span>
              </>
            )}
            {ad.format === 'prompt' && (
              <>
                <div className="simula-ad-title">Try this:</div>
                <div className="simula-ad-description">{ad.content}</div>
              </>
            )}
            {(ad.format === 'all' || !['text', 'prompt'].includes(ad.format)) && (
              <>
                <div className="simula-ad-title">Sponsored Content</div>
                <div className="simula-ad-description">{ad.content}</div>
                <span className="simula-ad-cta">Learn More</span>
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  return <div ref={elementRef}>{renderContent()}</div>;
};