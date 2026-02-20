import React, { useState, useEffect, useCallback } from 'react';
import { MiniGameInterstitialProps, MiniGameInterstitialTheme } from '../../types';
import defaultBackgroundImage from '../../assets/minigame_interstitial_background.png';

const defaultTheme: Required<MiniGameInterstitialTheme> = {
  cornerRadius: 16,
  characterSize: 120,
  textColor: '#FFFFFF',
  textSize: 24,
};

export const MiniGameInterstitial: React.FC<MiniGameInterstitialProps> = ({
  charImage,
  invitationText = 'Want to play a game?',
  ctaText = 'Play a Game',
  backgroundImage,
  theme = {},
  isOpen,
  onClick,
  onClose,
}) => {
  const [imageError, setImageError] = useState(false);
  const [closedInternally, setClosedInternally] = useState(false);
  const appliedTheme = { ...defaultTheme, ...theme };

  const isVisible = isOpen && !closedInternally;

  // Reset internal close state when parent re-opens
  useEffect(() => {
    if (isOpen) {
      setClosedInternally(false);
      setImageError(false);
    }
  }, [isOpen]);

  // Reset image error when charImage changes
  useEffect(() => {
    setImageError(false);
  }, [charImage]);

  const handleClose = useCallback(() => {
    setClosedInternally(true);
    onClose?.();
  }, [onClose]);

  const handleCtaClick = useCallback(() => {
    setClosedInternally(true);
    onClose?.();
    onClick();
  }, [onClose, onClick]);

  // Prevent body scroll when visible
  useEffect(() => {
    if (isVisible) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isVisible]);

  // Handle ESC key
  useEffect(() => {
    if (!isVisible) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isVisible, handleClose]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) {
        handleClose();
      }
    },
    [handleClose],
  );

  if (!isVisible) return null;

  const bgImage = backgroundImage ?? defaultBackgroundImage;
  const backdropStyle: React.CSSProperties = {
    backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.6)), url(${bgImage})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  };

  return (
    <div
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9998,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'miniGameInterstitialFadeIn 0.3s ease-in',
        fontFamily: 'Inter, system-ui, sans-serif',
        ...backdropStyle,
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Game invitation"
    >
      <style>{`
        @keyframes miniGameInterstitialFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>

      {/* Content */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '24px',
        }}
      >
        {/* Character image in circle */}
        {!imageError ? (
          <img
            src={charImage}
            alt="AI companion"
            onError={() => setImageError(true)}
            style={{
              width: `${appliedTheme.characterSize}px`,
              height: `${appliedTheme.characterSize}px`,
              borderRadius: '50%',
              objectFit: 'cover',
              border: '3px solid rgba(255, 255, 255, 0.2)',
            }}
          />
        ) : (
          <div
            style={{
              width: `${appliedTheme.characterSize}px`,
              height: `${appliedTheme.characterSize}px`,
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: `${appliedTheme.characterSize * 0.4}px`,
              border: '3px solid rgba(255, 255, 255, 0.2)',
            }}
          >
            🎮
          </div>
        )}

        {/* Invitation text */}
        <div
          style={{
            color: appliedTheme.textColor,
            fontSize: `${appliedTheme.textSize}px`,
            fontWeight: 700,
            textAlign: 'center',
            maxWidth: '320px',
            lineHeight: 1.3,
          }}
        >
          {invitationText}
        </div>

        {/* CTA button */}
        <button
          onClick={handleCtaClick}
          style={{
            backgroundColor: '#3B82F6',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: `${appliedTheme.cornerRadius}px`,
            padding: '14px 32px',
            fontSize: '16px',
            fontWeight: 600,
            fontFamily: 'Inter, system-ui, sans-serif',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'opacity 0.2s ease, transform 0.1s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '0.9';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '1';
            e.currentTarget.style.transform = 'scale(1)';
          }}
          onMouseDown={(e) => {
            e.currentTarget.style.transform = 'scale(0.97)';
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          <span style={{ fontSize: '14px' }}>&#9654;</span>
          {ctaText}
        </button>

        {/* Close link */}
        <button
          onClick={handleClose}
          style={{
            background: 'none',
            border: 'none',
            color: appliedTheme.textColor,
            opacity: 0.6,
            cursor: 'pointer',
            fontSize: '14px',
            fontFamily: 'Inter, system-ui, sans-serif',
            padding: '4px 8px',
            transition: 'opacity 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '0.9';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '0.6';
          }}
        >
          Not now
        </button>
      </div>
    </div>
  );
};
