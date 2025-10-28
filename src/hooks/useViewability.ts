import { useState, useEffect, useRef } from 'react';
import type { ViewabilityResult, ViewabilityOptions } from '../types';

export const useViewability = (options: ViewabilityOptions = {}): ViewabilityResult & { 
  elementRef: React.RefObject<HTMLDivElement>;
  trackImpression: (adId?: string) => void;
} => {
  const { threshold = 0.5, durationMs = 1000, onImpressionTracked } = options;

  const elementRef = useRef<HTMLDivElement>(null);
  const [isViewable, setIsViewable] = useState(false);
  const [hasBeenViewed, setHasBeenViewed] = useState(false);
  const [impressionTracked, setImpressionTracked] = useState(false);
  const [viewableStartTime, setViewableStartTime] = useState<number | null>(null);
  const [hasMetDuration, setHasMetDuration] = useState(false);

  useEffect(() => {
    if (!elementRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const viewable = entry.intersectionRatio >= threshold;
        const now = Date.now();
        
        if (viewable) {
          if (viewableStartTime === null) {
            setViewableStartTime(now);
          }
          setIsViewable(true);
          
          if (!hasBeenViewed) {
            setHasBeenViewed(true);
          }
        } else {
          setViewableStartTime(null);
          setIsViewable(false);
          setHasMetDuration(false);
        }
      },
      { 
        threshold,
        rootMargin: '0px'
      }
    );

    observer.observe(elementRef.current);
    return () => observer.disconnect();
  }, [threshold, hasBeenViewed, viewableStartTime]);

  // Duration tracking effect
  useEffect(() => {
    if (!isViewable || viewableStartTime === null || hasMetDuration) return;

    const timeoutId = setTimeout(() => {
      if (isViewable && viewableStartTime !== null) {
        const elapsed = Date.now() - viewableStartTime;
        if (elapsed >= durationMs) {
          setHasMetDuration(true);
        }
      }
    }, durationMs);

    return () => clearTimeout(timeoutId);
  }, [isViewable, viewableStartTime, durationMs, hasMetDuration]);

  const trackImpression = (adId?: string) => {
    if (impressionTracked) return;
    
    setImpressionTracked(true);
    
    if (onImpressionTracked && adId) {
      onImpressionTracked(adId);
    }
  };

  return {
    elementRef,
    isViewable: isViewable && hasMetDuration, // MRC-compliant viewability (with duration)
    isInstantViewable: isViewable, // Instant viewability (no duration requirement)
    hasBeenViewed,
    impressionTracked,
    trackImpression
  };
}; 