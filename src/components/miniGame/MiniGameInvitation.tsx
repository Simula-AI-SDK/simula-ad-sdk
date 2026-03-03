import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MiniGameInvitationProps, MiniGameInvitationTheme, MiniGameInvitationAnimation } from '../../types';
import { toWidthCSS, toOffsetCSS } from '../../utils/parseWidth';

const defaultTheme: Required<MiniGameInvitationTheme> = {
  cornerRadius: 16,
  backgroundColor: 'rgba(0, 0, 0, 0.65)',
  textColor: '#FFFFFF',
  titleTextColor: '#FFFFFF',
  subTextColor: '#FFFFFF',
  ctaTextColor: '#FFFFFF',
  ctaColor: '#3B82F6',
  charImageCornerRadius: 12,
  charImageAnchor: 'left',
  borderWidth: 1,
  borderColor: 'rgba(255, 255, 255, 0.1)',
  fontFamily: 'Inter, system-ui, sans-serif',
};

const ANIMATION_DURATION = 300; // ms

const getEntryAnimation = (animation: MiniGameInvitationAnimation): string => {
  switch (animation) {
    case 'auto':
    case 'slideDown':
      return 'miniGameInvitationSlideDown';
    case 'slideUp':
      return 'miniGameInvitationSlideUp';
    case 'fadeIn':
      return 'miniGameInvitationFadeIn';
    case 'none':
      return 'none';
    default:
      return 'miniGameInvitationSlideDown';
  }
};

const getExitAnimation = (animation: MiniGameInvitationAnimation): string => {
  switch (animation) {
    case 'auto':
    case 'slideDown':
      return 'miniGameInvitationSlideDownExit';
    case 'slideUp':
      return 'miniGameInvitationSlideUpExit';
    case 'fadeIn':
      return 'miniGameInvitationFadeOut';
    case 'none':
      return 'none';
    default:
      return 'miniGameInvitationSlideDownExit';
  }
};

export const MiniGameInvitation: React.FC<MiniGameInvitationProps> = ({
  titleText = 'Want to play a game?',
  subText = 'Take a break and challenge yourself!',
  ctaText = 'Play a Game',
  charImage,
  animation = 'auto',
  theme = {},
  isOpen: isOpenProp,
  autoCloseDuration,
  width,
  top = 0.05,
  onClick,
  onClose,
}) => {
  const [imageError, setImageError] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const autoCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const appliedTheme = { ...defaultTheme, ...theme };

  const isOpen = isOpenProp ?? false;

  const clearTimers = useCallback(() => {
    if (autoCloseTimerRef.current) {
      clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = null;
    }
    if (closingTimerRef.current) {
      clearTimeout(closingTimerRef.current);
      closingTimerRef.current = null;
    }
  }, []);

  // Handle open/close state
  useEffect(() => {
    if (isOpen) {
      setIsClosing(false);
      setShouldRender(true);
      setImageError(false);
    } else {
      clearTimers();
      setShouldRender(false);
      setIsClosing(false);
    }
  }, [isOpen, clearTimers]);

  // Auto-close timer
  useEffect(() => {
    if (isOpen && autoCloseDuration && autoCloseDuration > 0) {
      autoCloseTimerRef.current = setTimeout(() => {
        handleCloseInternal();
      }, autoCloseDuration);
    }
    return () => {
      if (autoCloseTimerRef.current) {
        clearTimeout(autoCloseTimerRef.current);
        autoCloseTimerRef.current = null;
      }
    };
  }, [isOpen, autoCloseDuration]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCloseInternal = useCallback(
    (additionalCallback?: () => void) => {
      clearTimers();
      if (animation === 'none') {
        onClose?.();
        additionalCallback?.();
        return;
      }
      setIsClosing(true);
      closingTimerRef.current = setTimeout(() => {
        setShouldRender(false);
        setIsClosing(false);
        onClose?.();
        additionalCallback?.();
      }, ANIMATION_DURATION);
    },
    [animation, clearTimers, onClose],
  );

  const handleCtaClick = useCallback(() => {
    handleCloseInternal(onClick);
  }, [handleCloseInternal, onClick]);

  const handleDismiss = useCallback(() => {
    handleCloseInternal();
  }, [handleCloseInternal]);

  if (!shouldRender) return null;

  const entryAnim = getEntryAnimation(animation);
  const exitAnim = getExitAnimation(animation);
  const currentAnimation = isClosing ? exitAnim : entryAnim;
  const animationStyle =
    currentAnimation !== 'none'
      ? `${currentAnimation} ${ANIMATION_DURATION}ms ease-out${isClosing ? ' forwards' : ''}`
      : 'none';

  return (
    <div
      style={{
        borderRadius: `${appliedTheme.cornerRadius}px`,
        backgroundColor: appliedTheme.backgroundColor,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: `${appliedTheme.borderWidth}px solid ${appliedTheme.borderColor}`,
        boxShadow: '0 4px 24px rgba(0, 0, 0, 0.12), 0 1px 4px rgba(0, 0, 0, 0.08)',
        overflow: 'hidden',
        height: '120px',
        animation: animationStyle,
        display: 'flex',
        flexDirection: appliedTheme.charImageAnchor === 'right' ? 'row' : 'row-reverse',
        alignItems: 'stretch',
        fontFamily: appliedTheme.fontFamily,
        position: 'fixed',
        width: toWidthCSS(width),
        zIndex: 9997,
        top: toOffsetCSS(top),
        left: '0',
        right: '0',
        marginLeft: 'auto',
        marginRight: 'auto',
      }}
    >
      <style>{`
        @keyframes miniGameInvitationSlideDown {
          from { transform: translateY(-20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes miniGameInvitationSlideDownExit {
          from { transform: translateY(0); opacity: 1; }
          to { transform: translateY(-20px); opacity: 0; }
        }
        @keyframes miniGameInvitationSlideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes miniGameInvitationSlideUpExit {
          from { transform: translateY(0); opacity: 1; }
          to { transform: translateY(20px); opacity: 0; }
        }
        @keyframes miniGameInvitationFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes miniGameInvitationFadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
      `}</style>

      {/* Left side: text + CTA */}
      <div
        style={{
          flex: 1,
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: '4px',
          minWidth: 0,
        }}
      >
        <div
          style={{
            fontSize: '16px',
            fontWeight: 700,
            color: appliedTheme.titleTextColor || appliedTheme.textColor,
            lineHeight: '1.3',
          }}
        >
          {titleText}
        </div>
        <div
          style={{
            fontSize: '13px',
            fontWeight: 400,
            color: appliedTheme.subTextColor || appliedTheme.textColor,
            lineHeight: '1.4',
            marginBottom: '6px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {subText}
        </div>
        <button
          onClick={handleCtaClick}
          style={{
            backgroundColor: appliedTheme.ctaColor,
            color: appliedTheme.ctaTextColor || '#FFFFFF',
            border: 'none',
            borderRadius: '8px',
            padding: '6px 16px',
            fontSize: '13px',
            fontWeight: 600,
            fontFamily: appliedTheme.fontFamily,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            width: '100%',
            transition: 'opacity 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '0.9';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '1';
          }}
        >
          <span style={{ fontSize: '12px' }}>&#9654;</span>
          {ctaText}
        </button>
      </div>

      {/* Character image — square, padded */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          padding: appliedTheme.charImageAnchor === 'right' ? '0 16px 0 0' : '0 0 0 16px',
        }}
      >
        {!imageError ? (
          <img
            src={charImage}
            alt="AI companion"
            onError={() => setImageError(true)}
            style={{
              width: '88px',
              height: '88px',
              objectFit: 'cover',
              display: 'block',
              borderRadius: `${appliedTheme.charImageCornerRadius}px`,
            }}
          />
        ) : (
          <div
            style={{
              width: '88px',
              height: '88px',
              borderRadius: `${appliedTheme.charImageCornerRadius}px`,
              backgroundColor: '#F3F4F6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '32px',
            }}
          >
            🎮
          </div>
        )}
      </div>

      {/* Close button — always shown */}
      <button
        onClick={handleDismiss}
        aria-label="Close"
        style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          width: '24px',
          height: '24px',
          border: 'none',
          background: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          color: appliedTheme.textColor,
          opacity: 0.4,
          fontSize: '16px',
          lineHeight: 1,
          transition: 'opacity 0.2s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = '0.7';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = '0.4';
        }}
      >
        &#10005;
      </button>
    </div>
  );
};
