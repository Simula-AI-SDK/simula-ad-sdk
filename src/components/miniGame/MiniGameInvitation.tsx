import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MiniGameInvitationProps, MiniGameInvitationTheme, MiniGameInvitationAnimation } from '../../types';

const defaultTheme: Required<MiniGameInvitationTheme> = {
  cornerRadius: 16,
  primaryColor: '#FFFFFF',
  secondaryColor: '#F3F4F6',
  textColor: '#1F2937',
  ctaColor: '#3B82F6',
  charImageCornerRadius: 12,
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
  trigger,
  isOpen: isOpenProp,
  autoCloseDuration,
  onClick,
  onClose,
}) => {
  const [imageError, setImageError] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const [triggerFired, setTriggerFired] = useState(false);
  const autoCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const appliedTheme = { ...defaultTheme, ...theme };

  // Determine effective open state: trigger-managed or prop-managed
  const isOpen = trigger ? triggerFired : (isOpenProp ?? false);

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

  // Trigger: afterDelay
  useEffect(() => {
    if (!trigger?.afterDelay || triggerFired) return;
    triggerTimerRef.current = setTimeout(() => {
      setTriggerFired(true);
    }, trigger.afterDelay);
    return () => {
      if (triggerTimerRef.current) {
        clearTimeout(triggerTimerRef.current);
        triggerTimerRef.current = null;
      }
    };
  }, [trigger?.afterDelay, triggerFired]);

  // Trigger: onIdle
  useEffect(() => {
    if (!trigger?.onIdle || triggerFired) return;

    const resetIdleTimer = () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
      idleTimerRef.current = setTimeout(() => {
        setTriggerFired(true);
      }, trigger.onIdle);
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((event) => document.addEventListener(event, resetIdleTimer, { passive: true }));

    // Start the initial idle timer
    resetIdleTimer();

    return () => {
      events.forEach((event) => document.removeEventListener(event, resetIdleTimer));
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
    };
  }, [trigger?.onIdle, triggerFired]);

  // Trigger: onScrollPercent
  useEffect(() => {
    if (!trigger?.onScrollPercent || triggerFired) return;

    const handleScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const docHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      if (docHeight <= 0) return;
      const scrollPercent = (scrollTop / docHeight) * 100;
      if (scrollPercent >= (trigger.onScrollPercent as number)) {
        setTriggerFired(true);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    // Check immediately in case already scrolled past
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [trigger?.onScrollPercent, triggerFired]);

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
      // If trigger-managed, mark as no longer fired so it doesn't re-show
      if (trigger) {
        setTriggerFired(false);
      }
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
    [animation, clearTimers, trigger, onClose],
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
        backgroundColor: appliedTheme.primaryColor,
        boxShadow: '0 4px 24px rgba(0, 0, 0, 0.12), 0 1px 4px rgba(0, 0, 0, 0.08)',
        overflow: 'hidden',
        animation: animationStyle,
        display: 'flex',
        alignItems: 'stretch',
        fontFamily: 'Inter, system-ui, sans-serif',
        position: 'relative',
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
          padding: '20px',
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
            color: appliedTheme.textColor,
            lineHeight: '1.3',
          }}
        >
          {titleText}
        </div>
        <div
          style={{
            fontSize: '13px',
            fontWeight: 400,
            color: appliedTheme.textColor,
            opacity: 0.65,
            lineHeight: '1.4',
            marginBottom: '12px',
          }}
        >
          {subText}
        </div>
        <button
          onClick={handleCtaClick}
          style={{
            backgroundColor: appliedTheme.ctaColor,
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '8px',
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: 600,
            fontFamily: 'Inter, system-ui, sans-serif',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            alignSelf: 'flex-start',
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

      {/* Right side: character image */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px 20px 16px 0',
          flexShrink: 0,
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
              borderRadius: `${appliedTheme.charImageCornerRadius}px`,
            }}
          />
        ) : (
          <div
            style={{
              width: '88px',
              height: '88px',
              borderRadius: `${appliedTheme.charImageCornerRadius}px`,
              backgroundColor: appliedTheme.secondaryColor,
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
