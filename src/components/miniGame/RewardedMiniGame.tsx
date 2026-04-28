import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RewardedMiniGameProps } from '../../types';
import { initRewardedGame, fetchAdForMinigame, verifyReward, reportAdInterstitial } from '../../utils/api';
import { logger } from '../../utils/logger';
import { useSimula } from '../../SimulaProvider';
import { CloseButton } from './CloseButton';
import { MiniGameMenu } from './MiniGameMenu';
import { WidgetShell } from '../WidgetShell';

type Phase = 'idle' | 'loading' | 'playing' | 'ad' | 'claim' | 'verifying' | 'done';

const AD_DURATION = 5; // seconds — Simula-controlled, not publisher-configurable
const MIN_GAME_HEIGHT = 500;

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

  // Desktop detection for centered modal vs. mobile bottom-sheet layout.
  // Mirrors GameIframe.tsx so the rewarded session uses the same phone-case
  // shape as the regular minigame flow.
  const [viewportWidth, setViewportWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );
  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const isDesktop = viewportWidth >= 768;

  // Clamp minPlayThreshold to [10, 30] with warning
  const clampedThreshold = (() => {
    if (minPlayThreshold < 10 || minPlayThreshold > 30) {
      logger.warn(
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
        logger.debug('[RewardedMiniGame] Failed to initialize:', err);
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

      // In devMode, skip real ad and use aditude placeholder.
      // Fire the close-flow medrec report immediately (race-resistant against
      // tab-close navigation). WidgetShell's bridge skips medrec divIds to
      // avoid double-counting; banner/rails are reported separately by it.
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
        } catch {
          // Swallow — falls through to aditude fallback below.
        }
      }

      // Fallback: aditude if available.
      // Close-flow reportAd fires immediately to beat any tab-close race;
      // WidgetShell's bridge handles banner/rails (if any) and skips medrec.
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
        logger.debug(`[RewardedMiniGame] SSV attempt ${retries + 1} failed:`, err);
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

  const inAdPhase = phase === 'ad' || phase === 'claim' || phase === 'verifying';

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
        .simula-rgp-claim-btn {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 6px 12px 6px 10px;
          border: none;
          border-radius: 9999px;
          background-color: #FFFFFF;
          color: #0F0F0F;
          font-family: "Inter", -apple-system, "SF Pro Display", "SF Pro Text", system-ui, Roboto, Arial, sans-serif;
          font-size: 12px;
          font-weight: 600;
          line-height: 1;
          white-space: nowrap;
          -webkit-tap-highlight-color: transparent;
          transition: background-color 0.15s ease;
        }
        .simula-rgp-claim-btn:hover:not(:disabled) {
          background-color: #E8E8E8;
        }
        .simula-rgp-claim-btn:active:not(:disabled) {
          background-color: #DCDCDC;
        }
        .simula-rgp-claim-btn:disabled {
          cursor: default;
        }
        .simula-rgp-claim-spinner {
          width: 11px;
          height: 11px;
          border: 1.5px solid rgba(0, 0, 0, 0.25);
          border-top-color: #0F0F0F;
          border-radius: 50%;
          animation: simula-rgp-spin 0.8s linear infinite;
          display: inline-block;
          box-sizing: border-box;
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

      {/* Sized phone-case container — wraps the playing iframe AND the
          ad/claim/verifying phase so the rewarded session looks structurally
          identical to the regular GameIframe flow. Drag-handle from
          GameIframe is intentionally dropped (rewarded is timer-locked). */}
      {(phase === 'playing' || inAdPhase) && (
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Phase: playing — WidgetShell game variant inside the phone case. */}
          {phase === 'playing' && iframeUrl && (
            <div
              style={{
                width: '100%',
                flex: 1,
                minHeight: !isDesktop ? `${MIN_GAME_HEIGHT}px` : undefined,
                display: 'flex',
              }}
            >
              <WidgetShell
                variant="game"
                gameUrl={iframeUrl}
                showBanner
                serveId={serveId}
                style={{ width: '100%', height: '100%' }}
              />
            </div>
          )}

          {/* Phase: ad / claim / verifying — real ad iframe or Aditude fallback
              rendered into the same phone-case slot. */}
          {inAdPhase && (
            <div
              style={{
                width: '100%',
                flex: 1,
                minHeight: !isDesktop ? `${MIN_GAME_HEIGHT}px` : undefined,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
              }}
            >
              {/* Real ad iframe */}
              {adIframeUrl && (
                <iframe
                  src={adIframeUrl}
                  style={{
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    display: 'block',
                  }}
                  title="Advertisement"
                  allow="fullscreen"
                  sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms"
                />
              )}

              {/* Aditude fallback ad — variant="medrec" mirrors MiniGameMenu's
                  standalone Aditude path so it inherits the regular Aditude
                  rail rendering. */}
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
                  <WidgetShell variant="medrec" serveId={serveId} />
                </div>
              )}
            </div>
          )}

          {/* Overlays (countdown ring / close button / claim pill) live on top
              of the sized container regardless of which inner phase content
              is mounted — top-right corner is anchored to this container. */}

          {/* Playing phase: countdown ring, then CloseButton */}
          {phase === 'playing' && playCountdown > 0 && (
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
          )}

          {phase === 'playing' && playCountdown === 0 && (
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

          {/* Ad-phase countdown ring */}
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

          {/* Claim Reward button — appears after ad countdown ends. Flat
              utilitarian pill in the spirit of AdMob/AppLovin/YouTube reward
              CTAs: white background, dark text, single small icon, no
              gradient/shimmer/glow. */}
          {(phase === 'claim' || phase === 'verifying') && (
            <button
              type="button"
              onClick={handleClaimReward}
              disabled={phase === 'verifying'}
              className="simula-rgp-claim-btn"
              aria-label={phase === 'verifying' ? 'Verifying reward' : 'Claim reward'}
              style={{
                position: 'absolute',
                top: 'max(12px, env(safe-area-inset-top, 12px))',
                right: 'max(12px, env(safe-area-inset-right, 12px))',
                zIndex: 10001,
                cursor: phase === 'verifying' ? 'default' : 'pointer',
                opacity: phase === 'verifying' ? 0.7 : 1,
              }}
            >
              {phase === 'verifying' ? (
                <span className="simula-rgp-claim-spinner" aria-hidden="true" />
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  width="12"
                  height="12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
              <span>
                {phase === 'verifying' ? 'Verifying' : 'Claim Reward'}
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
