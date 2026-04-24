import React, { useEffect, useRef, useState, useMemo, useCallback, useContext } from 'react';
import { getMinigame } from '../../utils/api';
import { Message, MinigameResponse } from '../../types';
import { useSimula } from '../../SimulaProvider';
import { CloseButton } from './CloseButton';
import { WidgetShell } from '../WidgetShell';
import { SimulaImperativeContext } from '../../imperative/SimulaImperativeContext';

const MIN_GAME_HEIGHT = 500;
const HANDLE_HEIGHT = 28; // 12px padding top + 4px bar + 12px padding bottom

interface GameIframeProps {
  gameId: string;
  charID: string;
  charName: string;
  charImage: string;
  messages?: Message[];
  delegateChar?: boolean;
  onClose: () => void;
  onAdIdReceived?: (adId: string) => void;
  onServeIdReceived?: (serveId: string) => void;
  charDesc?: string;
  convId?: string;
  entryPoint?: string;
  menuId?: string | null;
  /** Controls the height of the game iframe (px, percentage, or null for fullscreen) */
  playableHeight?: number | string;
  /** Background color for the bottom sheet border area */
  playableBorderColor?: string;
  /** Whether to show a banner ad at the top of the game. Default: true */
  showBanner?: boolean;
  /**
   * Internal-only. Pre-fetched minigame bootstrap. When present, the iframe
   * skips its own getMinigame() call and renders from this payload directly.
   * @internal
   */
  _preloadedMinigame?: MinigameResponse;
}

export const GameIframe: React.FC<GameIframeProps> = ({
  gameId,
  charID,
  charName,
  charImage,
  messages = [],
  delegateChar = true,
  onClose,
  onAdIdReceived,
  onServeIdReceived,
  charDesc,
  convId,
  entryPoint,
  menuId,
  playableHeight,
  playableBorderColor = '#262626',
  showBanner = true,
  _preloadedMinigame,
}) => {
  const imperativeCtx = useContext(SimulaImperativeContext);
  const overlayRef = useRef<HTMLDivElement>(null);
  const { sessionId } = useSimula();
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);
  const [serveId, setServeId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const sessionIdRef = useRef<string | undefined>(sessionId);
  const currentRequestRef = useRef<Promise<void> | null>(null);
  const initKeyRef = useRef<string | null>(null);

  // Desktop detection for bottom-sheet vs. centered layout.
  const [viewportWidth, setViewportWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const isDesktop = viewportWidth >= 768;

  const MIN_PLAYABLE_HEIGHT = MIN_GAME_HEIGHT + (!isDesktop ? HANDLE_HEIGHT : 0);

  // Drag-to-resize state (mobile bottom sheet only)
  const [resizedHeight, setResizedHeight] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef<number>(0);
  const dragStartHeight = useRef<number>(0);

  // Keep ref in sync with sessionId
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  // Track whether mount-failure has already been surfaced so _onMountFailed
  // can only fire once per lifecycle. Matches the DISPLAY_FAILED-once
  // contract in SimulaMiniGameInterstitial.
  const mountFailedFiredRef = useRef(false);

  // Fetch the minigame iframe URL (passed into WidgetShell as gameUrl).
  // When `_preloadedMinigame` is provided by the imperative manager, skip
  // the network call entirely and hydrate from the preload payload.
  useEffect(() => {
    if (!sessionId) {
      const sessionErr = new Error('Session invalid, cannot initialize minigame');
      setError(sessionErr.message);
      setLoading(false);
      if (!mountFailedFiredRef.current) {
        mountFailedFiredRef.current = true;
        imperativeCtx?.onEvent('DISPLAY_FAILED', { error: sessionErr });
      }
      return;
    }

    // Imperative preload short-circuit: hydrate synchronously.
    if (_preloadedMinigame) {
      try {
        const response = _preloadedMinigame;
        if (!response.adResponse || !response.adResponse.iframe_url) {
          throw new Error('Preloaded minigame payload missing iframe_url');
        }
        setIframeUrl(response.adResponse.iframe_url);
        if (response.adResponse.serve_id) {
          setServeId(response.adResponse.serve_id);
        }
        if (onAdIdReceived && response.adResponse.ad_id) {
          onAdIdReceived(response.adResponse.ad_id);
        }
        if (onServeIdReceived && response.adResponse.serve_id) {
          onServeIdReceived(response.adResponse.serve_id);
        }
        setError(null);
        setLoading(false);
      } catch (err) {
        console.error('Error hydrating preloaded minigame:', err);
        setError('Failed to load game. Please try again.');
        setLoading(false);
        if (!mountFailedFiredRef.current) {
          mountFailedFiredRef.current = true;
          imperativeCtx?.onEvent('DISPLAY_FAILED', { error: err });
        }
      }
      return;
    }

    const initKey = `${gameId}-${charID}-${sessionId}`;

    if (currentRequestRef.current && initKeyRef.current === initKey) {
      return;
    }

    initKeyRef.current = initKey;

    const initMinigame = async () => {
      const currentSessionId = sessionIdRef.current;
      if (!currentSessionId) {
        const sessionErr = new Error('Session invalid, cannot initialize minigame');
        setError(sessionErr.message);
        setLoading(false);
        if (initKeyRef.current === initKey) {
          currentRequestRef.current = null;
          initKeyRef.current = null;
        }
        if (!mountFailedFiredRef.current) {
          mountFailedFiredRef.current = true;
          imperativeCtx?.onEvent('DISPLAY_FAILED', { error: sessionErr });
        }
        return;
      }

      try {
        setLoading(true);
        const response = await getMinigame({
          gameType: gameId,
          sessionId: currentSessionId,
          convId: convId,
          entryPoint: entryPoint,
          currencyMode: false,
          w: window.innerWidth,
          h: window.innerHeight,
          char_id: charID,
          char_name: charName,
          char_image: charImage,
          char_desc: charDesc,
          messages: messages,
          delegate_char: delegateChar,
          menuId: menuId ?? undefined,
        });

        if (initKeyRef.current !== initKey) return;

        setIframeUrl(response.adResponse.iframe_url);
        if (response.adResponse.serve_id) {
          setServeId(response.adResponse.serve_id);
        }
        if (onAdIdReceived && response.adResponse.ad_id) {
          onAdIdReceived(response.adResponse.ad_id);
        }
        if (onServeIdReceived && response.adResponse.serve_id) {
          onServeIdReceived(response.adResponse.serve_id);
        }
      } catch (err) {
        if (initKeyRef.current !== initKey) return;
        console.error('Error initializing minigame:', err);
        setError('Failed to load game. Please try again.');
        if (!mountFailedFiredRef.current) {
          mountFailedFiredRef.current = true;
          imperativeCtx?.onEvent('DISPLAY_FAILED', { error: err });
        }
      } finally {
        if (initKeyRef.current === initKey) {
          setLoading(false);
          currentRequestRef.current = null;
        }
      }
    };

    const requestPromise = initMinigame();
    currentRequestRef.current = requestPromise;

    return () => {
      // Parameter-change detection handled via initKeyRef inside the async
      // function — no abort needed here.
    };
  }, [gameId, charID, charName, charImage, charDesc, delegateChar, sessionId, menuId, _preloadedMinigame, imperativeCtx]);

  // ESC to close + lock body scroll while open
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === overlayRef.current) onClose();
  };

  // Calculate container height based on playableHeight prop (bottom sheet mode).
  const handleOffset = !isDesktop ? HANDLE_HEIGHT : 0;

  const { containerHeight, isBottomSheet } = useMemo(() => {
    if (playableHeight === undefined || playableHeight === null) {
      return { containerHeight: null, isBottomSheet: false };
    }

    const screenHeight = window.innerHeight;

    if (typeof playableHeight === 'number') {
      if (playableHeight > 0 && playableHeight < 1) {
        if (playableHeight >= 0.95) {
          return { containerHeight: null, isBottomSheet: false };
        }
        const computed = Math.max(Math.min(screenHeight * playableHeight + handleOffset, screenHeight), MIN_PLAYABLE_HEIGHT);
        return { containerHeight: computed, isBottomSheet: true };
      }
      const clamped = Math.max(Math.min(playableHeight + handleOffset, screenHeight), MIN_PLAYABLE_HEIGHT);
      if (clamped >= screenHeight * 0.95) {
        return { containerHeight: null, isBottomSheet: false };
      }
      return { containerHeight: clamped, isBottomSheet: true };
    }

    if (typeof playableHeight === 'string') {
      if (playableHeight.toLowerCase() === 'auto') {
        return { containerHeight: null, isBottomSheet: false };
      }
      if (playableHeight.includes('%')) {
        const pct = parseFloat(playableHeight) / 100;
        if (!isNaN(pct)) {
          if (pct >= 0.95) {
            return { containerHeight: null, isBottomSheet: false };
          }
          const computed = Math.max(Math.min(screenHeight * pct + handleOffset, screenHeight), MIN_PLAYABLE_HEIGHT);
          return { containerHeight: computed, isBottomSheet: true };
        }
      }
      const parsed = parseFloat(playableHeight);
      if (!isNaN(parsed)) {
        const clamped = Math.max(Math.min(parsed + handleOffset, screenHeight), MIN_PLAYABLE_HEIGHT);
        if (clamped >= screenHeight * 0.95) {
          return { containerHeight: null, isBottomSheet: false };
        }
        return { containerHeight: clamped, isBottomSheet: true };
      }
    }

    return { containerHeight: null, isBottomSheet: false };
  }, [playableHeight, MIN_PLAYABLE_HEIGHT, handleOffset]);

  const baseHeight = resizedHeight ?? containerHeight;
  const effectiveHeight = baseHeight;

  // Re-clamp resizedHeight on window resize
  useEffect(() => {
    if (resizedHeight === null) return;
    const handleResize = () => {
      const screenHeight = window.innerHeight;
      const clamped = Math.max(Math.min(resizedHeight, screenHeight), MIN_PLAYABLE_HEIGHT);
      if (clamped >= screenHeight * 0.95) {
        setResizedHeight(screenHeight);
      } else if (clamped !== resizedHeight) {
        setResizedHeight(clamped);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [resizedHeight]);

  // Drag-to-resize handlers (mobile bottom sheet)
  const handleDragStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const currentHeight = effectiveHeight ?? window.innerHeight;
    dragStartY.current = e.clientY;
    dragStartHeight.current = currentHeight;
    setIsDragging(true);
  }, [effectiveHeight]);

  const handleDragMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    const deltaY = dragStartY.current - e.clientY;
    const screenHeight = window.innerHeight;
    const newHeight = Math.max(Math.min(dragStartHeight.current + deltaY, screenHeight), MIN_PLAYABLE_HEIGHT);
    setResizedHeight(newHeight);
  }, [isDragging, MIN_PLAYABLE_HEIGHT]);

  const handleDragEnd = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    setIsDragging(false);
    if (resizedHeight !== null && resizedHeight >= window.innerHeight * 0.95) {
      setResizedHeight(window.innerHeight);
    }
  }, [isDragging, resizedHeight]);

  const shellReady = !loading && !error && iframeUrl;

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        zIndex: 9999,
        display: 'flex',
        alignItems: isDesktop ? 'center' : (isBottomSheet ? 'flex-end' : 'center'),
        justifyContent: 'center',
        animation: 'fadeIn 0.2s ease-in',
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Game iframe"
    >
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>

      <div
        style={{
          position: 'relative',
          width: '100%',
          height: !isDesktop && effectiveHeight !== null ? `${effectiveHeight}px` : '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: !isDesktop && isBottomSheet ? 'flex-end' : 'center',
          pointerEvents: 'none',
          transition: isDragging ? 'none' : 'height 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          ...(!isDesktop && isBottomSheet ? { animation: 'slideUp 0.3s ease-out' } : {}),
        }}
      >
        {/* Bottom-sheet drag handle (mobile only, when playableHeight is set) */}
        {isBottomSheet && !isDesktop && (
          <div
            onPointerDown={handleDragStart}
            onPointerMove={handleDragMove}
            onPointerUp={handleDragEnd}
            onPointerCancel={handleDragEnd}
            style={{
              width: '100%',
              backgroundColor: playableBorderColor,
              borderTopLeftRadius: '16px',
              borderTopRightRadius: '16px',
              padding: '12px 0',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              pointerEvents: 'auto',
              cursor: isDragging ? 'grabbing' : 'grab',
              touchAction: 'none',
              userSelect: 'none',
            }}
          >
            <div
              style={{
                width: '36px',
                height: '4px',
                backgroundColor: 'rgba(0, 0, 0, 0.2)',
                borderRadius: '2px',
              }}
            />
          </div>
        )}

        <CloseButton
          onClick={onClose}
          ariaLabel="Close game"
          style={{
            position: 'absolute',
            top: '50px',
            right: '16px',
            zIndex: 10002,
            pointerEvents: 'auto',
          }}
        />

        {loading && (
          <div style={{
            color: '#FFFFFF',
            fontSize: '18px',
            fontWeight: '500',
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            Loading game...
          </div>
        )}

        {error && (
          <div style={{
            color: '#FFFFFF',
            fontSize: '18px',
            fontWeight: '500',
            textAlign: 'center',
            padding: '20px',
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {error}
          </div>
        )}

        {shellReady && (
          <div
            style={{
              width: '100%',
              flex: 1,
              minHeight: 0,
              display: 'flex',
              pointerEvents: 'auto',
            }}
          >
            <WidgetShell
              variant="game"
              gameUrl={iframeUrl!}
              showBanner={showBanner}
              serveId={serveId}
              style={{ width: '100%', height: '100%' }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
