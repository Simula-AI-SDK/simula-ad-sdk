import React, { useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { getMinigame } from '../../utils/api';

interface GameIframeProps {
  gameId: string;
  charID: string;
  onClose: () => void;
}

export const GameIframe: React.FC<GameIframeProps> = ({ gameId, charID, onClose }) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const sessionToken = useRef<string>(uuidv4());
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch the minigame iframe URL
  useEffect(() => {
    const initMinigame = async () => {
      try {
        setLoading(true);
        const response = await getMinigame({
          game_type: gameId,
          session_id: sessionToken.current,
          currency_mode: false,
          w: window.innerWidth,
          h: window.innerHeight,
        });
        setIframeUrl(response.adResponse.iframe_url);
      } catch (err) {
        console.error('Error initializing minigame:', err);
        setError('Failed to load game. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    initMinigame();
  }, [gameId, charID]);

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
        alignItems: 'center',
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
      `}</style>
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'rgba(255, 255, 255, 0.9)',
            border: 'none',
            borderRadius: '50%',
            width: '40px',
            height: '40px',
            fontSize: '24px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            color: '#1F2937',
            fontWeight: 'bold',
            transition: 'background-color 0.2s ease',
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
          }}>
            {error}
          </div>
        )}

        {!loading && !error && iframeUrl && (
          <iframe
            src={iframeUrl}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              display: 'block',
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

