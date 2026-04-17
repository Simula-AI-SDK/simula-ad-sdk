import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RewardedMiniGameProps } from '../../types';
import { initRewardedGame, fetchAdForMinigame, verifyReward, reportAdInterstitial } from '../../utils/api';
import { useSimula } from '../../SimulaProvider';
import { CloseButton } from './CloseButton';
import { MiniGameMenu } from './MiniGameMenu';
import { WidgetShell } from '../WidgetShell';

type Phase = 'idle' | 'loading' | 'playing' | 'ad' | 'claim' | 'verifying' | 'done';

const AD_DURATION = 5; // seconds — Simula-controlled, not publisher-configurable

export const RewardedMiniGame: React.FC<RewardedMiniGameProps> = ({
  isOpen,
  charName,
  charID,
  charImage,
  charDesc,
  minPlayThreshold = 15,
  onRewardVerified,
  onRewardVerificationFailed,
  messages = [],
}) => {
  const { sessionId, devMode, aditudeReady, aditudeConfig } = useSimula();
  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;

  const [phase, setPhase] = useState<Phase>('idle');
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);
  const [serveId, setServeId] = useState<string | null>(null);
  const [adId, setAdId] = useState<string | null>(null);
  const [durationSeconds, setDurationSeconds] = useState<number>(minPlayThreshold);
  const [playCountdown, setPlayCountdown] = useState<number>(0);
  const [adCountdown, setAdCountdown] = useState<number>(AD_DURATION);
  const [adIframeUrl, setAdIframeUrl] = useState<string | null>(null);
  const [showAditude, setShowAditude] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const playStartRef = useRef<number>(0);
  const playTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const adTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const adFetchingRef = useRef(false);
  const verifyingRef = useRef(false);

  // Clamp minPlayThreshold to [10, 30] with warning
  const clampedThreshold = (() => {
    if (minPlayThreshold < 10 || minPlayThreshold > 30) {
      console.warn(
        `[RewardedMiniGame] minPlayThreshold ${minPlayThreshold} is out of range [10, 30]. Clamping to ${Math.max(10, Math.min(30, minPlayThreshold))}.`
      );
    }
    return Math.max(10, Math.min(30, Math.round(minPlayThreshold)));
  })();

  // Cleanup all timers
  const clearAllTimers = useCallback(() => {
    if (playTimerRef.current) {
      clearInterval(playTimerRef.current);
      playTimerRef.current = null;
    }
    if (adTimerRef.current) {
      clearInterval(adTimerRef.current);
      adTimerRef.current = null;
    }
  }, []);

  // Reset all state when component closes
  const resetState = useCallback(() => {
    clearAllTimers();
    setPhase('idle');
    setIframeUrl(null);
    setServeId(null);
    setAdId(null);
    setAdIframeUrl(null);
    setShowAditude(false);
    setShowMenu(false);
    setError(null);
    setPlayCountdown(0);
    setAdCountdown(AD_DURATION);
    adFetchingRef.current = false;
    verifyingRef.current = false;
    playStartRef.current = 0;
  }, [clearAllTimers]);

  // Phase: idle → loading when isOpen becomes true
  useEffect(() => {
    if (isOpen && phase === 'idle') {
      setPhase('loading');
    } else if (!isOpen && phase !== 'idle') {
      resetState();
    }
  }, [isOpen, phase, resetState]);

  // Phase: loading — init the rewarded game
  useEffect(() => {
    if (phase !== 'loading') return;
    if (!sessionIdRef.current) {
      setError('Session invalid');
      return;
    }

    let cancelled = false;

    const init = async () => {
      try {
        const response = await initRewardedGame({
          sessionId: sessionIdRef.current!,
          w: window.innerWidth,
          h: window.innerHeight,
          charId: charID,
          charName: charName,
          charImage: charImage,
          charDesc: charDesc,
          messages: messages,
          minPlayThreshold: clampedThreshold,
        });

        if (cancelled) return;

        setIframeUrl(response.iframe_url);
        setServeId(response.serve_id);
        setAdId(response.ad_id);
        setDurationSeconds(response.duration_seconds);
        setPlayCountdown(response.duration_seconds);
        setPhase('playing');
        playStartRef.current = Date.now();
      } catch (err) {
        if (cancelled) return;
        console.error('[RewardedMiniGame] Failed to initialize:', err);
        setError('Failed to load game.');
        // PRD: game iframe fails to load → no session created; close button never appears
      }
    };

    init();
    return () => { cancelled = true; };
  }, [phase, charID, charName, charImage, charDesc, clampedThreshold]);

  // Phase: playing — countdown timer
  useEffect(() => {
    if (phase !== 'playing') return;

    setPlayCountdown(durationSeconds);
    playTimerRef.current = setInterval(() => {
      setPlayCountdown((prev) => {
        if (prev <= 1) {
          if (playTimerRef.current) {
            clearInterval(playTimerRef.current);
            playTimerRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (playTimerRef.current) {
        clearInterval(playTimerRef.current);
        playTimerRef.current = null;
      }
    };
  }, [phase, durationSeconds]);

  // Phase: ad — load ad and start 5s countdown
  useEffect(() => {
    if (phase !== 'ad') return;

    let cancelled = false;

    // Fire-and-forget interstitial report
    const reportAd = (adSource: 'simula' | 'aditude' | 'none', renderedFormat?: string) => {
      if (serveId && sessionIdRef.current) {
        reportAdInterstitial({
          serveId,
          sessionId: sessionIdRef.current,
          adSource,
          renderedFormat,
        });
      }
    };

    const loadAd = async () => {
      if (adFetchingRef.current) return;
      adFetchingRef.current = true;

      // In devMode, skip real ad and use aditude placeholder
      if (devMode) {
        if (!cancelled) {
          setShowAditude(true);
          startAdCountdown();
          reportAd('aditude', 'medrec');
        }
        adFetchingRef.current = false;
        return;
      }

      // Try to fetch the real ad
      if (adId) {
        try {
          const url = await fetchAdForMinigame(adId, sessionIdRef.current!);
          if (!cancelled && url) {
            setAdIframeUrl(url);
            startAdCountdown();
            reportAd('simula');
            adFetchingRef.current = false;
            return;
          }
        } catch (err) {
          console.error('[RewardedMiniGame] Failed to fetch ad:', err);
        }
      }

      // Fallback: aditude if available
      if (!cancelled && (aditudeReady && aditudeConfig?.enabled)) {
        setShowAditude(true);
        startAdCountdown();
        reportAd('aditude', 'medrec');
        adFetchingRef.current = false;
        return;
      }

      // PRD: If ads.html fails to load → 5s grace period then Claim Reward
      if (!cancelled) {
        startAdCountdown();
        reportAd('none');
      }
      adFetchingRef.current = false;
    };

    loadAd();
    return () => { cancelled = true; };
  }, [phase, adId, devMode, aditudeReady, aditudeConfig]);

  // Start the 5-second ad countdown
  const startAdCountdown = useCallback(() => {
    setAdCountdown(AD_DURATION);
    adTimerRef.current = setInterval(() => {
      setAdCountdown((prev) => {
        if (prev <= 1) {
          if (adTimerRef.current) {
            clearInterval(adTimerRef.current);
            adTimerRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // When ad countdown hits 0, move to claim phase
  useEffect(() => {
    if (phase === 'ad' && adCountdown === 0) {
      setPhase('claim');
    }
  }, [phase, adCountdown]);

  // Handle user closing game (after timer elapses)
  const handleGameClose = useCallback(() => {
    if (playCountdown > 0) return; // Timer still running — no exit allowed
    setPhase('ad');
  }, [playCountdown]);

  // Handle "Claim Reward" tap
  const handleClaimReward = useCallback(async () => {
    if (verifyingRef.current) return;
    verifyingRef.current = true;
    setPhase('verifying');

    const elapsedPlayTime = (Date.now() - playStartRef.current) / 1000;
    let retries = 0;

    const attemptVerify = async (): Promise<boolean> => {
      try {
        const result = await verifyReward({
          serveId: serveId!,
          sessionId: sessionIdRef.current!,
          elapsedPlayTime,
        });
        return result.verified;
      } catch (err) {
        console.error(`[RewardedMiniGame] SSV attempt ${retries + 1} failed:`, err);
        return false;
      }
    };

    // PRD: retry once on failure
    let verified = await attemptVerify();
    if (!verified) {
      retries++;
      verified = await attemptVerify();
    }

    verifyingRef.current = false;

    if (verified) {
      onRewardVerified();
      setPhase('done');
      setShowMenu(true);
    } else {
      onRewardVerificationFailed?.();
      // Stay on claim screen — don't auto-close so publisher callback can handle it
    }
  }, [serveId, onRewardVerified, onRewardVerificationFailed]);

  // Handle menu close (post-reward)
  const handleMenuClose = useCallback(() => {
    setShowMenu(false);
    resetState();
  }, [resetState]);

  // Prevent body scroll
  useEffect(() => {
    if (phase !== 'idle') {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [phase]);

  // Nothing to render
  if (phase === 'idle' && !showMenu) return null;

  // Post-reward: MiniGameMenu only
  if (phase === 'done' && showMenu) {
    return (
      <MiniGameMenu
        isOpen={true}
        onClose={handleMenuClose}
        charName={charName}
        charID={charID}
        charImage={charImage}
        charDesc={charDesc}
        messages={messages}
      />
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Rewarded game play"
    >
      <style>{`
        @keyframes simula-rgp-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes simula-rgp-countdown-ring {
          from { stroke-dashoffset: 0; }
          to { stroke-dashoffset: 81.68; }
        }
      `}</style>

      {/* Phase: loading */}
      {phase === 'loading' && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
          color: '#FFFFFF',
        }}>
          {error ? (
            <span style={{ fontSize: '16px' }}>{error}</span>
          ) : (
            <>
              <div style={{
                width: '40px',
                height: '40px',
                border: '3px solid rgba(255, 255, 255, 0.1)',
                borderTop: '3px solid #FFFFFF',
                borderRadius: '50%',
                animation: 'simula-rgp-spin 1s linear infinite',
              }} />
              <span style={{ fontSize: '16px' }}>Loading game...</span>
            </>
          )}
        </div>
      )}

      {/* Phase: playing — game iframe with timer overlay */}
      {phase === 'playing' && iframeUrl && (
        <div style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <iframe
            src={iframeUrl}
            style={{
              width: '100%',
              flex: 1,
              border: 'none',
              display: 'block',
            }}
            title="Rewarded game"
            allow="fullscreen"
            sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms"
          />

          {/* Timer / Close button overlay on top of iframe */}
          {playCountdown > 0 ? (
            // Countdown ring while timer is running
            <div
              style={{
                position: 'absolute',
                top: 'max(16px, env(safe-area-inset-top, 16px))',
                right: 'max(16px, env(safe-area-inset-right, 16px))',
                width: '32px',
                height: '32px',
                zIndex: 10000,
              }}
              aria-label={`Game closes in ${playCountdown} seconds`}
            >
              <svg
                viewBox="0 0 32 32"
                width="32"
                height="32"
                style={{ transform: 'rotate(90deg) scaleX(-1)' }}
              >
                <circle cx="16" cy="16" r="13" fill="rgba(0, 0, 0, 0.4)" stroke="none" />
                <circle
                  cx="16"
                  cy="16"
                  r="13"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="3"
                  strokeDasharray="81.68"
                  strokeDashoffset="0"
                  strokeLinecap="round"
                  style={{
                    animation: `simula-rgp-countdown-ring ${durationSeconds}s linear forwards`,
                  }}
                />
              </svg>
              <span
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  color: '#ffffff',
                  fontWeight: '600',
                }}
              >
                {playCountdown}
              </span>
            </div>
          ) : (
            // Close button appears after timer elapses
            <CloseButton
              onClick={handleGameClose}
              ariaLabel="Close game"
              style={{
                position: 'absolute',
                top: 'max(16px, env(safe-area-inset-top, 16px))',
                right: 'max(16px, env(safe-area-inset-right, 16px))',
                zIndex: 10000,
              }}
            />
          )}
        </div>
      )}

      {/* Phase: ad / claim / verifying — ad interstitial with Claim Reward */}
      {(phase === 'ad' || phase === 'claim' || phase === 'verifying') && (
        <div style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {/* Ad countdown timer (top-right, during ad phase) */}
          {phase === 'ad' && adCountdown > 0 && (
            <div
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                width: '32px',
                height: '32px',
                minWidth: '32px',
                minHeight: '32px',
                zIndex: 10000,
              }}
              aria-label={`Ad finishes in ${adCountdown} seconds`}
            >
              <svg
                viewBox="0 0 32 32"
                width="32"
                height="32"
                style={{ transform: 'rotate(90deg) scaleX(-1)' }}
              >
                <circle cx="16" cy="16" r="13" fill="rgba(0, 0, 0, 0.4)" stroke="none" />
                <circle
                  cx="16"
                  cy="16"
                  r="13"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="3"
                  strokeDasharray="81.68"
                  strokeDashoffset="0"
                  strokeLinecap="round"
                  style={{
                    animation: `simula-rgp-countdown-ring ${AD_DURATION}s linear forwards`,
                  }}
                />
              </svg>
              <span
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  color: '#ffffff',
                  fontWeight: '600',
                }}
              >
                {adCountdown}
              </span>
            </div>
          )}

          {/* Ad iframe (real ad) */}
          {adIframeUrl && (
            <iframe
              src={adIframeUrl}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                display: 'block',
                position: 'absolute',
                top: 0,
                left: 0,
              }}
              title="Advertisement"
              allow="fullscreen"
              sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms"
            />
          )}

          {/* Aditude fallback ad */}
          {showAditude && !adIframeUrl && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
            }}>
              <span
                style={{
                  color: 'rgba(255, 255, 255, 0.5)',
                  fontSize: '11px',
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase',
                }}
              >
                Ad
              </span>
              <WidgetShell variant="rewarded_medrec" />
            </div>
          )}

          {/* Claim Reward button — appears after ad countdown ends */}
          {(phase === 'claim' || phase === 'verifying') && (
            <button
              onClick={handleClaimReward}
              disabled={phase === 'verifying'}
              style={{
                position: 'absolute',
                bottom: 'max(40px, env(safe-area-inset-bottom, 40px))',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 10001,
                padding: '14px 40px',
                fontSize: '17px',
                fontWeight: '700',
                color: '#FFFFFF',
                backgroundColor: phase === 'verifying' ? 'rgba(59, 130, 246, 0.6)' : '#3B82F6',
                border: 'none',
                borderRadius: '14px',
                cursor: phase === 'verifying' ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                boxShadow: '0 4px 14px rgba(59, 130, 246, 0.4)',
                transition: 'background-color 0.2s ease',
                whiteSpace: 'nowrap',
              }}
            >
              {phase === 'verifying' && (
                <div style={{
                  width: '18px',
                  height: '18px',
                  border: '2px solid rgba(255, 255, 255, 0.3)',
                  borderTop: '2px solid #FFFFFF',
                  borderRadius: '50%',
                  animation: 'simula-rgp-spin 1s linear infinite',
                }} />
              )}
              {phase === 'verifying' ? 'Verifying...' : 'Claim Reward'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
