import { useState, useEffect, useRef } from 'react';
import type { ViewabilityResult, ViewabilityOptions } from '../types';

export const useViewability = (options: ViewabilityOptions = {}): ViewabilityResult & { 
  elementRef: React.RefObject<HTMLDivElement>;
  trackImpression: (adId?: string) => void;
} => {
  const { threshold = 0.5, onImpressionTracked } = options;

  const elementRef = useRef<HTMLDivElement>(null);
  const [isViewable, setIsViewable] = useState(false);
  const [hasBeenViewed, setHasBeenViewed] = useState(false);
  const [impressionTracked, setImpressionTracked] = useState(false);

  useEffect(() => {
    if (!elementRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const viewable = entry.intersectionRatio >= threshold;
        setIsViewable(viewable);
        
        if (viewable && !hasBeenViewed) {
          setHasBeenViewed(true);
        }
      },
      { 
        threshold,
        rootMargin: '0px'
      }
    );

    observer.observe(elementRef.current);
    return () => observer.disconnect();
  }, [threshold, hasBeenViewed]);

  const trackImpression = (adId?: string) => {
    if (impressionTracked) return;
    
    setImpressionTracked(true);
    console.log('Impression tracked for ad:', adId);
    
    if (onImpressionTracked && adId) {
      onImpressionTracked(adId);
    }
  };

  return {
    elementRef,
    isViewable,
    hasBeenViewed,
    impressionTracked,
    trackImpression
  };
}; 