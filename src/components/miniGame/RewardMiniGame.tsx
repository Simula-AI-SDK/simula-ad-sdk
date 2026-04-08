import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RewardMiniGameProps, RewardMiniGameTheme } from '../../types';
import { useSimula } from '../../SimulaProvider';
import { initRewardedGame, verifyReward, InitRewardedGameResponse } from '../../utils/api';
import { MiniGameMenu } from './MiniGameMenu';

type Phase = 'loading' | 'playing' | 'threshold_met' | 'claiming' | 'completed' | 'post_game' | 'abandoned' | 'error';

const defaultTheme: Required<RewardMiniGameTheme> = {
  overlayBackgroundColor: 'rgba(0, 0, 0, 0.95)',
  claimButtonColor: '#22C55E',
  claimButtonTextColor: '#FFFFFF',
  claimButtonCornerRadius: 12,
  claimButtonText: 'Claim Reward',
  claimButtonPosition: 'bottom-right',
  fontFamily: 'Inter, system-ui, sans-serif',
};

export const RewardMiniGame: React.FC<RewardMiniGameProps> = ({
  isOpen,
  charName,
  charID,
  charImage,
  minPlayThreshold,
  onRewardCompleted,
  onRewardAbandoned,
  onRewardVerificationFailed,
  onGameOpen,
  onGameClose,
  theme,
  messages,
  charDesc,
}) => {
  const { sessionId } = useSimula();
  const appliedTheme = { ...defaultTheme, ...theme };

  const [phase, setPhase] = useState<Phase>('loading');
  const [gameData, setGameData] = useState<InitRewardedGameResponse | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const timerStartRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Clamp threshold to [10, 30]
  const clampedThreshold = Math.max(10, Math.min(30, minPlayThreshold));

  // Cleanup timer
  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    timerStartRef.current = null;
  }, []);

  // Start timer using Date.now() delta for accuracy across backgrounding
  const startTimer = useCallback(() => {
    timerStartRef.current = Date.now();
    intervalRef.current = setInterval(() => {
      if (timerStartRef.current) {
        const elapsed = Math.floor((Date.now() - timerStartRef.current) / 1000);
        setElapsedSeconds(elapsed);
      }
    }, 1000);
  }, []);

  // Initialize game when isOpen becomes true
  useEffect(() => {
    if (!isOpen) {
      // Reset state when closed
      setPhase('loading');
      setGameData(null);
      setElapsedSeconds(0);
      setError(null);
      clearTimer();
      return;
    }

    if (!sessionId) {
      setError('No session available');
      setPhase('error');
      return;
    }

    let cancelled = false;

    const initGame = async () => {
      try {
        const data = await initRewardedGame({
          sessionId,
          charID,
          charName,
          charImage,
          charDesc,
          messages,
          minPlayThreshold: clampedThreshold,
          w: window.innerWidth,
          h: window.innerHeight,
        });

        if (cancelled) return;
        setGameData(data);
        setPhase('playing');
        onGameOpen?.(data.name, data.description);
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to initialize rewarded game:', err);
        setError('Failed to load game');
        setPhase('error');
      }
    };

    initGame();

    return () => {
      cancelled = true;
      clearTimer();
    };
  }, [isOpen]);

  // Check threshold and transition to threshold_met
  useEffect(() => {
    if (phase === 'playing' && gameData && elapsedSeconds >= gameData.duration_seconds) {
      setPhase('threshold_met');
    }
  }, [elapsedSeconds, phase, gameData]);

  // Prevent body scroll when open
  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Start timer when iframe loads
  const handleIframeLoad = useCallback(() => {
    if (phase === 'playing' && !timerStartRef.current) {
      startTimer();
    }
  }, [phase, startTimer]);

  // Handle abandon (X button)
  const handleAbandon = useCallback(() => {
    clearTimer();
    onGameClose?.(gameData?.name ?? '');
    onRewardAbandoned();
  }, [clearTimer, onGameClose, gameData, onRewardAbandoned]);

  // Handle claim reward
  const handleClaim = useCallback(async () => {
    if (!gameData || !sessionId) return;
    setPhase('claiming');

    try {
      const result = await verifyReward({
        serve_id: gameData.serve_id,
        session_id: sessionId,
        elapsed_play_time: elapsedSeconds,
      });

      if (result.verified && result.token) {
        setPhase('post_game');
        clearTimer();
        onRewardCompleted(result.token);
      } else {
        onRewardVerificationFailed?.();
        setPhase('threshold_met');
      }
    } catch (err) {
      console.error('Reward verification failed:', err);
      onRewardVerificationFailed?.();
      setPhase('threshold_met');
    }
  }, [gameData, sessionId, elapsedSeconds, clearTimer, onRewardCompleted, onRewardVerificationFailed]);

  // Handle post-game menu close
  const handlePostGameClose = useCallback(() => {
    onGameClose?.(gameData?.name ?? '');
  }, [onGameClose, gameData]);

  if (!isOpen) return null;

  // Post-game: show MiniGameMenu
  if (phase === 'post_game') {
    return (
      <MiniGameMenu
        isOpen={true}
        onClose={handlePostGameClose}
        charName={charName}
        charID={charID}
        charImage={charImage}
        messages={messages}
        charDesc={charDesc}
        onGameOpen={onGameOpen}
        onGameClose={onGameClose}
        title={`Browse More Games with ${charName}?`}
      />
    );
  }

  const remainingSeconds = gameData ? Math.max(0, gameData.duration_seconds - elapsedSeconds) : 0;
  const showClaimButton = phase === 'threshold_met';
  const showSpinner = phase === 'claiming';

  // Position styles for claim button
  const positionStyles: React.CSSProperties = (() => {
    switch (appliedTheme.claimButtonPosition) {
      case 'bottom-left':
        return { bottom: 24, left: 24 };
      case 'top-right':
        return { top: 80, right: 24 };
      case 'top-left':
        return { top: 80, left: 24 };
      case 'bottom-right':
      default:
        return { bottom: 24, right: 24 };
    }
  })();

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: appliedTheme.overlayBackgroundColor,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: appliedTheme.fontFamily,
      }}
    >
      {/* X (Abandon) Button — always visible */}
      <button
        onClick={handleAbandon}
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          zIndex: 100001,
          background: 'rgba(0, 0, 0, 0.6)',
          border: 'none',
          borderRadius: '50%',
          width: 36,
          height: 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: '#fff',
          fontSize: 18,
          fontWeight: 'bold',
          lineHeight: 1,
        }}
        aria-label="Close"
      >
        &times;
      </button>

      {/* Timer display */}
      {phase !== 'loading' && phase !== 'error' && (
        <div
          style={{
            position: 'absolute',
            top: 16,
            left: 16,
            zIndex: 100001,
            background: 'rgba(0, 0, 0, 0.6)',
            borderRadius: 8,
            padding: '6px 12px',
            color: '#fff',
            fontSize: 14,
            fontWeight: 600,
            fontFamily: appliedTheme.fontFamily,
          }}
        >
          {remainingSeconds > 0
            ? `${remainingSeconds}s remaining`
            : 'Reward ready!'}
        </div>
      )}

      {/* Loading state */}
      {phase === 'loading' && (
        <div style={{ color: '#fff', fontSize: 16 }}>Loading game...</div>
      )}

      {/* Error state */}
      {phase === 'error' && (
        <div style={{ color: '#fff', fontSize: 16, textAlign: 'center', padding: 24 }}>
          <div>{error ?? 'Something went wrong'}</div>
          <button
            onClick={handleAbandon}
            style={{
              marginTop: 16,
              padding: '8px 24px',
              background: '#fff',
              color: '#000',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            Go Back
          </button>
        </div>
      )}

      {/* Game iframe */}
      {gameData && phase !== 'error' && (
        <iframe
          ref={iframeRef}
          src={gameData.iframe_url}
          onLoad={handleIframeLoad}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            display: 'block',
          }}
          allow="autoplay"
          title={gameData.name}
        />
      )}

      {/* Claim Reward button */}
      {showClaimButton && (
        <button
          onClick={handleClaim}
          style={{
            position: 'absolute',
            zIndex: 100001,
            padding: '14px 28px',
            backgroundColor: appliedTheme.claimButtonColor,
            color: appliedTheme.claimButtonTextColor,
            border: 'none',
            borderRadius: appliedTheme.claimButtonCornerRadius,
            fontSize: 16,
            fontWeight: 700,
            fontFamily: appliedTheme.fontFamily,
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            ...positionStyles,
          }}
        >
          {appliedTheme.claimButtonText}
        </button>
      )}

      {/* Claiming spinner */}
      {showSpinner && (
        <div
          style={{
            position: 'absolute',
            zIndex: 100001,
            padding: '14px 28px',
            backgroundColor: appliedTheme.claimButtonColor,
            color: appliedTheme.claimButtonTextColor,
            borderRadius: appliedTheme.claimButtonCornerRadius,
            fontSize: 16,
            fontWeight: 700,
            fontFamily: appliedTheme.fontFamily,
            opacity: 0.8,
            ...positionStyles,
          }}
        >
          Verifying...
        </div>
      )}
    </div>
  );
};
