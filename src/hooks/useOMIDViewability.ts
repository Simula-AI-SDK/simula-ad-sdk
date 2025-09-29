import { useState, useEffect, useRef } from 'react';

interface OMIDViewabilityResult {
  isViewable: boolean;
  hasBeenViewed: boolean;
  impressionTracked: boolean;
}

interface OMIDOptions {
  threshold?: number;
  durationMs?: number;
  partnerName?: string;
  partnerVersion?: string;
  onImpressionTracked?: (adId: string) => void;
}

// OMID Service Script - This should be loaded globally
declare global {
  interface Window {
    omidSessionClient?: any;
    omidSessionService?: any;
  }
}

export const useOMIDViewability = (options: OMIDOptions = {}): OMIDViewabilityResult & { 
  elementRef: React.RefObject<HTMLDivElement>;
  trackImpression: (adId?: string) => void;
} => {
  const {
    threshold = 0.5,
    durationMs = 1000,
    partnerName = 'Simula-Ad-SDK',
    partnerVersion = '1.0.0',
    onImpressionTracked
  } = options;

  const elementRef = useRef<HTMLDivElement>(null);
  const [isViewable, setIsViewable] = useState(false);
  const [hasBeenViewed, setHasBeenViewed] = useState(false);
  const [impressionTracked, setImpressionTracked] = useState(false);
  const [viewableStartTime, setViewableStartTime] = useState<number | null>(null);
  const [hasMetDuration, setHasMetDuration] = useState(false);
  
  const omidSessionRef = useRef<any>(null);
  const adEventsRef = useRef<any>(null);

  useEffect(() => {
    if (!elementRef.current) return;

    // Initialize OMID Session
    const initializeOMID = async () => {
      try {
        // Load OMID Service Script dynamically if not already loaded
        if (!window.omidSessionClient) {
          await loadOMIDServiceScript();
        }

        const sessionClient = window.omidSessionClient?.['1.0.0'];
        if (!sessionClient) {
          console.warn('OMID Session Client not available, falling back to basic viewability');
          initializeFallbackViewability();
          return;
        }

        // Create OMID partner and context
        const Partner = sessionClient.Partner;
        const Context = sessionClient.Context;
        const AdSession = sessionClient.AdSession;
        const AdEvents = sessionClient.AdEvents;

        const partner = new Partner(partnerName, partnerVersion);
        const context = new Context(partner, [], null); // No verification scripts for now
        
        // Create ad session
        const adSession = new AdSession(context);
        adSession.setCreativeType('display');
        adSession.setImpressionType('beginToRender');

        omidSessionRef.current = adSession;

        // Set the ad view
        context.setSlotElement(elementRef.current);

        // Start session
        adSession.start();

        // Create ad events handler
        adEventsRef.current = new AdEvents(adSession);

        // Register session observer for viewability events
        adSession.registerSessionObserver((event: any) => {
          switch (event.type) {
            case 'sessionStart':
              console.log('OMID session started');
              // Signal ad loaded
              adEventsRef.current?.loaded();
              break;
            case 'sessionError':
              console.error('OMID session error:', event.data);
              initializeFallbackViewability();
              break;
            case 'sessionFinish':
              console.log('OMID session finished');
              break;
            case 'geometryChange':
              handleGeometryChange(event.data);
              break;
          }
        });

      } catch (error) {
        console.warn('OMID initialization failed, using fallback:', error);
        initializeFallbackViewability();
      }
    };

    const loadOMIDServiceScript = async (): Promise<void> => {
      return new Promise((resolve, reject) => {
        // Check if script is already loaded
        if (document.querySelector('script[src*="omweb-v1.js"]')) {
          resolve();
          return;
        }

        const script = document.createElement('script');
        script.src = 'https://s0.2mdn.net/instream/omweb/omweb-v1.js'; // Official OMID Service Script
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load OMID script'));
        document.head.appendChild(script);
      });
    };

    const handleGeometryChange = (geometryData: any) => {
      if (!geometryData?.viewport || !geometryData?.adView) return;

      const { viewport, adView } = geometryData;
      
      // Calculate viewable area
      const viewableArea = calculateViewableArea(viewport, adView);
      const totalArea = adView.width * adView.height;
      const viewablePercentage = totalArea > 0 ? viewableArea / totalArea : 0;

      const newIsViewable = viewablePercentage >= threshold;
      const now = Date.now();
      
      if (newIsViewable) {
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
    };

    const calculateViewableArea = (viewport: any, adView: any): number => {
      const intersectionLeft = Math.max(viewport.x, adView.x);
      const intersectionTop = Math.max(viewport.y, adView.y);
      const intersectionRight = Math.min(viewport.x + viewport.width, adView.x + adView.width);
      const intersectionBottom = Math.min(viewport.y + viewport.height, adView.y + adView.height);

      const width = Math.max(0, intersectionRight - intersectionLeft);
      const height = Math.max(0, intersectionBottom - intersectionTop);

      return width * height;
    };

    // Fallback implementation using Intersection Observer
    const initializeFallbackViewability = () => {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            const newIsViewable = entry.intersectionRatio >= threshold;
            const now = Date.now();
            
            if (newIsViewable) {
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
          });
        },
        { 
          threshold,
          rootMargin: '0px'
        }
      );

      if (elementRef.current) {
        observer.observe(elementRef.current);
      }

      return () => {
        observer.disconnect();
      };
    };

    initializeOMID();

    // Cleanup
    return () => {
      if (omidSessionRef.current) {
        try {
          omidSessionRef.current.finish();
        } catch (error) {
          console.warn('Error finishing OMID session:', error);
        }
      }
    };
  }, [threshold, partnerName, partnerVersion, hasBeenViewed, viewableStartTime]);

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

    if (adEventsRef.current) {
      // Use OMID impression tracking
      try {
        adEventsRef.current.impressionOccurred();
        setImpressionTracked(true);
        console.log('OMID impression tracked');
        
        // After OMID tracks successfully, ping our backend
        if (onImpressionTracked && adId) {
          onImpressionTracked(adId);
        }
      } catch (error) {
        console.warn('OMID impression tracking failed:', error);
        setImpressionTracked(true); // Mark as tracked to prevent retries
      }
    } else {
      // Fallback impression tracking
      setImpressionTracked(true);
      console.log('Fallback impression tracked');
      
      // Still ping our backend even in fallback mode
      if (onImpressionTracked && adId) {
        onImpressionTracked(adId);
      }
    }
  };

  return {
    elementRef,
    isViewable: isViewable && hasMetDuration, // Only considered viewable after meeting duration
    hasBeenViewed,
    impressionTracked,
    trackImpression
  };
}; 