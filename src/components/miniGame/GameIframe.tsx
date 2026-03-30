import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { getMinigame } from '../../utils/api';
import { Message } from '../../types';
import { useSimula } from '../../SimulaProvider';
import { CloseButton } from './CloseButton';

const MIN_PLAYABLE_HEIGHT = 500;

interface GameIframeProps {
  gameId: string;
  charID: string;
  charName: string;
  charImage: string;
  messages?: Message[];
  delegateChar?: boolean;
  onClose: () => void;
  onAdIdReceived?: (adId: string) => void;
  charDesc?: string;
  convId?: string;
  entryPoint?: string;
  menuId?: string | null;
  /** Controls the height of the game iframe (px, percentage, or null for fullscreen) */
  playableHeight?: number | string;
  /** Background color for the bottom sheet border area */
  playableBorderColor?: string;
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
  charDesc,
  convId,
  entryPoint,
  menuId,
  playableHeight,
  playableBorderColor = '#262626',
}) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const { sessionId } = useSimula();
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const sessionIdRef = useRef<string | undefined>(sessionId);
  const currentRequestRef = useRef<Promise<void> | null>(null);
  const initKeyRef = useRef<string | null>(null);

  // Drag-to-resize state
  const [resizedHeight, setResizedHeight] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef<number>(0);
  const dragStartHeight = useRef<number>(0);

  // Keep ref in sync with sessionId
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  // Fetch the minigame iframe URL
  useEffect(() => {
    // Block if sessionId is missing or invalid
    if (!sessionId) {
      setError('Session invalid, cannot initialize minigame');
      setLoading(false);
      return;
    }

    // Create a unique key for this initialization based on the actual parameters
    const initKey = `${gameId}-${charID}-${sessionId}`;

    // Prevent multiple initializations with the same key
    if (currentRequestRef.current && initKeyRef.current === initKey) {
      console.log('[GameIframe] Initialization already in progress for key:', initKey);
      return;
    }

    // If there's a different request in progress, we'll let it complete but won't process its result
    // (the new request will override)
    if (currentRequestRef.current && initKeyRef.current !== initKey) {
      console.log('[GameIframe] New parameters detected, will override previous request. Old key:', initKeyRef.current, 'New key:', initKey);
    }

    // Set the key immediately
    initKeyRef.current = initKey;

    console.log('[GameIframe] Initializing minigame with sessionId:', sessionId);
    console.log('[GameIframe] sessionId from context:', sessionId);
    console.log('[GameIframe] sessionIdRef.current:', sessionIdRef.current);

    const initMinigame = async () => {
      // Use the latest sessionId from ref to avoid stale closures
      const currentSessionId = sessionIdRef.current;
      if (!currentSessionId) {
        console.error('[GameIframe] Session ID became undefined during initialization');
        setError('Session invalid, cannot initialize minigame');
        setLoading(false);
        if (initKeyRef.current === initKey) {
          currentRequestRef.current = null;
          initKeyRef.current = null;
        }
        return;
      }

      try {
        setLoading(true);
        console.log('[GameIframe] Calling getMinigame with sessionId:', currentSessionId);
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

        // Only process response if this is still the current request
        if (initKeyRef.current !== initKey) {
          console.log('[GameIframe] Response received but parameters changed, ignoring');
          return;
        }

        setIframeUrl(response.adResponse.iframe_url);
        // Callback with the ad_id for tracking
        if (onAdIdReceived && response.adResponse.ad_id) {
          onAdIdReceived(response.adResponse.ad_id);
        }
      } catch (err) {
        // Only set error if this is still the current request
        if (initKeyRef.current !== initKey) {
          console.log('[GameIframe] Error occurred but parameters changed, ignoring');
          return;
        }
        console.error('Error initializing minigame:', err);
        setError('Failed to load game. Please try again.');
      } finally {
        // Only update loading state if this is still the current request
        if (initKeyRef.current === initKey) {
          setLoading(false);
          currentRequestRef.current = null;
          // Don't clear initKeyRef here - let the next effect run decide
        }
      }
    };

    // Store the promise and execute
    const requestPromise = initMinigame();
    currentRequestRef.current = requestPromise;

    // Cleanup function
    return () => {
      // If parameters changed, the new effect will handle it
      // We don't need to abort here since we check initKeyRef in the async function
      console.log('[GameIframe] Cleanup for key:', initKey);
    };
  }, [gameId, charID, charName, charImage, charDesc, delegateChar, sessionId, menuId]);

  // Handle ESC key to close
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    // Prevent body scroll when iframe is open
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  // Handle click outside (on overlay) to close
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === overlayRef.current) {
      onClose();
    }
  };

  // Calculate container height based on playableHeight prop (matches RN SDK logic)
  const { containerHeight, isBottomSheet } = useMemo(() => {
    if (playableHeight === undefined || playableHeight === null) {
      return { containerHeight: null, isBottomSheet: false };
    }

    const screenHeight = window.innerHeight;

    if (typeof playableHeight === 'number') {
      // Treat values between 0 and 1 (exclusive) as percentages (e.g., 0.8 = 80%)
      if (playableHeight > 0 && playableHeight < 1) {
        if (playableHeight >= 0.95) {
          return { containerHeight: null, isBottomSheet: false };
        }
        const computed = Math.max(Math.min(screenHeight * playableHeight, screenHeight), MIN_PLAYABLE_HEIGHT);
        return { containerHeight: computed, isBottomSheet: true };
      }
      const clamped = Math.max(Math.min(playableHeight, screenHeight), MIN_PLAYABLE_HEIGHT);
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
          const computed = Math.max(Math.min(screenHeight * pct, screenHeight), MIN_PLAYABLE_HEIGHT);
          return { containerHeight: computed, isBottomSheet: true };
        }
      }

      // Numeric string without % (e.g., "600")
      const parsed = parseFloat(playableHeight);
      if (!isNaN(parsed)) {
        const clamped = Math.max(Math.min(parsed, screenHeight), MIN_PLAYABLE_HEIGHT);
        if (clamped >= screenHeight * 0.95) {
          return { containerHeight: null, isBottomSheet: false };
        }
        return { containerHeight: clamped, isBottomSheet: true };
      }
    }

    return { containerHeight: null, isBottomSheet: false };
  }, [playableHeight]);

  // Effective height: user-resized overrides calculated
  const effectiveHeight = resizedHeight ?? containerHeight;

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

  // Drag-to-resize handlers (Pointer Events for unified mouse+touch)
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
    const deltaY = dragStartY.current - e.clientY; // up = positive = taller
    const screenHeight = window.innerHeight;
    const newHeight = Math.max(Math.min(dragStartHeight.current + deltaY, screenHeight), MIN_PLAYABLE_HEIGHT);
    setResizedHeight(newHeight);
  }, [isDragging]);

  const handleDragEnd = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    setIsDragging(false);

    // Snap to fullscreen if >= 95% of screen height
    if (resizedHeight !== null && resizedHeight >= window.innerHeight * 0.95) {
      setResizedHeight(window.innerHeight);
    }
  }, [isDragging, resizedHeight]);

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
        alignItems: isBottomSheet ? 'flex-end' : 'center',
        justifyContent: 'center',
        animation: 'fadeIn 0.2s ease-in',
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Game iframe"
    >
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes slideUp {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
      `}</style>
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: effectiveHeight !== null ? `${effectiveHeight}px` : '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: isBottomSheet ? 'flex-end' : 'center',
          pointerEvents: 'none',
          transition: isDragging ? 'none' : 'height 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          ...(isBottomSheet ? {
            animation: 'slideUp 0.3s ease-out',
          } : {}),
        }}
      >
        {/* Bottom sheet header with draggable handle */}
        {isBottomSheet && (
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
            top: isBottomSheet ? '44px' : 'max(16px, env(safe-area-inset-top, 16px))',
            right: 'max(16px, env(safe-area-inset-right, 16px))',
            zIndex: 10000,
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

        {!loading && !error && iframeUrl && (
          <iframe
            src={iframeUrl}
            style={{
              width: '100%',
              flex: 1,
              border: 'none',
              display: 'block',
              pointerEvents: 'auto',
            }}
            title={`Game: ${gameId}`}
            allow="fullscreen"
            sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms"
          />
        )}
      </div>
    </div>
  );
};
