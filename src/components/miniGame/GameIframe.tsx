import React, { useEffect, useRef, useState, useMemo } from 'react';
import { getMinigame } from '../../utils/api';
import { Message } from '../../types';
import { useSimula } from '../../SimulaProvider';

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

  // Calculate effective height for bottom sheet mode
  const getIframeHeight = useMemo(() => {
    if (!playableHeight) return '100%';
    
    if (typeof playableHeight === 'number') {
      const minHeight = 500;
      return `${Math.max(playableHeight, minHeight)}px`;
    }
    
    if (typeof playableHeight === 'string' && playableHeight.includes('%')) {
      // For percentage, we'll handle it in CSS
      return playableHeight;
    }
    
    return '100%';
  }, [playableHeight]);

  const isBottomSheetMode = !!playableHeight;

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
        alignItems: isBottomSheetMode ? 'flex-end' : 'center',
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
          height: isBottomSheetMode ? getIframeHeight : '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: isBottomSheetMode ? 'flex-end' : 'center',
          pointerEvents: 'none',
          ...(isBottomSheetMode ? {
            animation: 'slideUp 0.3s ease-out',
          } : {}),
        }}
      >
        {/* Bottom sheet header with drag handle */}
        {isBottomSheetMode && (
          <div
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
            }}
          >
            <div
              style={{
                width: '40px',
                height: '4px',
                backgroundColor: 'rgba(255, 255, 255, 0.3)',
                borderRadius: '2px',
              }}
            />
          </div>
        )}
        
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          onTouchStart={(e) => {
            e.stopPropagation();
          }}
          style={{
            position: 'absolute',
            top: isBottomSheetMode ? '4px' : 'max(16px, env(safe-area-inset-top, 16px))',
            right: 'max(16px, env(safe-area-inset-right, 16px))',
            background: 'rgba(255, 255, 255, 0.9)',
            border: 'none',
            borderRadius: '50%',
            width: '48px',
            height: '48px',
            minWidth: '48px',
            minHeight: '48px',
            fontSize: '24px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            color: '#1F2937',
            fontWeight: 'bold',
            transition: 'background-color 0.2s ease',
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent',
            pointerEvents: 'auto',
            userSelect: 'none',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
          }}
          aria-label="Close game"
        >
          ×
        </button>

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

