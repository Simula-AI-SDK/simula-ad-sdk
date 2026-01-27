import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSimula } from '../../SimulaProvider';
import { useBotDetection } from '../../hooks/useBotDetection';
import { useViewability } from '../../hooks/useViewability';
import { FetchNativeAdResponse, fetchNativeBannerAd, trackImpression, trackViewportEntry, trackViewportExit } from '../../utils/api';
import { validateNativeBannerProps } from '../../utils/validation';
import { NativeBannerProps, AdData, filterContextForPrivacy } from '../../types';

// Helper functions for dimension validation
// Width < 1 is percentage (e.g., 0.8 = 80%), > 1 is pixels (e.g., 400.0 = 400px)
// null, undefined, 0, or 1 means fill container (min 320px)
const isPercentageWidth = (width: number | null | undefined): boolean => width != null && width > 0 && width < 1;
const isPixelWidth = (width: number | null | undefined): boolean => width != null && width > 1;
const needsWidthMeasurement = (width: number | null | undefined): boolean => width == null || width === 0 || width === 1 || isPercentageWidth(width);

export const NativeBannerTest: React.FC<NativeBannerProps> = (props) => {
  validateNativeBannerProps(props);
  const {slot, width, position, context} = props;
  const {sessionId} = useSimula();
  const [adResponse, setAdResponse] = useState<FetchNativeAdResponse | null>(null);
  const [adFetched, setAdFetched] = useState<boolean>(false);
  const [height, setHeight] = useState<number>(150);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const fetchAdData = useCallback(async () => {
    if (!sessionId) {return}
    const adData = await fetchNativeBannerAd({
        sessionId: sessionId,
        slot: slot,
        position: position,
        context: context,
        width: width ?? undefined,
    });
    setAdResponse(adData);
    setAdFetched(true);
  }, [sessionId, slot, position, context, width]);

  // Listen for postMessage from iframe with height updates
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const newHeight = event.data.height;
      console.log(`Received height from iframe with type ${event.data.type}: ${JSON.stringify(event.data)}`);
      setHeight(newHeight);
    }
    window.addEventListener('message', handleMessage);
    return () => {window.removeEventListener('message', handleMessage);};
  }, []);

  useEffect(() => {
    if (!sessionId || adFetched) return; // Don't fetch if already fetched or no sessionId
    fetchAdData();
  }, [sessionId, fetchAdData, adFetched]);

  return (
    <div
      className="simula-native-banner-content"
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
      }}
    >
      {adResponse?.ad && (
        <iframe
          ref={iframeRef}
          src={adResponse.ad.iframeUrl}
          className="simula-native-banner-frame"
          style={{
            display: 'block',
            verticalAlign: 'top',
            border: 0,
            margin: 0,
            padding: 0,
            width: '100%',
            height: `${height}px`,
          }}
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          title={`Native Banner: ${adResponse.ad.id}`}
        />
      )}
    </div>
  );
};
