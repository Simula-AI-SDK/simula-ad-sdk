import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MiniGameMenuProps, MiniGameTheme, GameData } from '../../types';
import { GameGrid } from './GameGrid';
import { GameIframe } from './GameIframe';
import { fetchCatalog, fetchAdForMinigame, trackMenuGameClick } from '../../utils/api';
import gamesUnavailableImage from '../../assets/games-unavailable.png';
import gameIconImage from '../../assets/game icon.png';
import { useSimula } from '../../SimulaProvider';
import { CloseButton } from './CloseButton';

const defaultTheme: Omit<Required<MiniGameTheme>, 'backgroundColor' | 'headerColor' | 'borderColor' | 'playableHeight' | 'playableBorderColor'> & { backgroundColor?: string; headerColor?: string; borderColor?: string; playableHeight?: number | string; playableBorderColor?: string } = {
  titleFont: 'Inter, system-ui, sans-serif',
  secondaryFont: 'Inter, system-ui, sans-serif',
  titleFontColor: '#ffffff',
  secondaryFontColor: 'rgba(255, 255, 255, 0.75)',
  iconCornerRadius: 8,
  borderColor: 'rgba(255, 255, 255, 0.06)',
  accentColor: '#3B82F6',
  backgroundColor: '#0b0b0f',
};

export const MiniGameMenu: React.FC<MiniGameMenuProps> = ({
  isOpen,
  onClose,
  charName,
  charID,
  charImage,
  messages = [],
  charDesc,
  convId,
  entryPoint,
  maxGamesToShow = 6,
  theme = {},
  delegateChar = true,
  navigationType = 'dot',
  onGameOpen,
  onGameClose,
}) => {
  const { apiKey } = useSimula();
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [selectedGameName, setSelectedGameName] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const [games, setGames] = useState<GameData[]>([]);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState(false);
  const [adFetched, setAdFetched] = useState(false);
  const [adIframeUrl, setAdIframeUrl] = useState<string | null>(null);
  const [currentAdId, setCurrentAdId] = useState<string | null>(null);
  const [adCountdown, setAdCountdown] = useState<number | null>(null);
  const adCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const adFetchingRef = useRef(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const adOverlayRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Ad countdown timer
  useEffect(() => {
    if (adIframeUrl) {
      setAdCountdown(5);
      adCountdownRef.current = setInterval(() => {
        setAdCountdown((prev) => {
          if (prev !== null && prev <= 1) {
            if (adCountdownRef.current) {
              clearInterval(adCountdownRef.current);
              adCountdownRef.current = null;
            }
            return 0;
          }
          return prev !== null ? prev - 1 : null;
        });
      }, 1000);
    } else {
      setAdCountdown(null);
      if (adCountdownRef.current) {
        clearInterval(adCountdownRef.current);
        adCountdownRef.current = null;
      }
    }
    return () => {
      if (adCountdownRef.current) {
        clearInterval(adCountdownRef.current);
        adCountdownRef.current = null;
      }
    };
  }, [adIframeUrl]);

  // Merge theme with defaults
  const appliedTheme: Omit<Required<MiniGameTheme>, 'backgroundColor' | 'headerColor' | 'borderColor' | 'playableHeight' | 'playableBorderColor'> & { backgroundColor?: string; headerColor?: string; borderColor?: string; playableHeight?: number | string; playableBorderColor?: string } = {
    ...defaultTheme,
    ...theme,
  };

  // Get character initials for fallback
  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };


  // Fetch catalog when menu opens
  useEffect(() => {
    if (!isOpen) return;

    const loadCatalog = async () => {
      setCatalogLoading(true);
      setCatalogError(false);
      try {
        const catalogResponse = await fetchCatalog();
        setGames(catalogResponse.games);
        setMenuId(catalogResponse.menuId || null);

        const imageUrls = catalogResponse.games
          .map((g: GameData) => g.gifCover || g.iconUrl)
          .filter(Boolean) as string[];

        await Promise.all(
          imageUrls.map(
            (url) =>
              new Promise<void>((resolve) => {
                const img = new Image();
                img.onload = () => resolve();
                img.onerror = () => resolve();
                img.src = url;
              })
          )
        );
      } catch (error) {
        console.error('Failed to load game catalog:', error);
        setCatalogError(true);
        setGames([]);
        setMenuId(null);
      } finally {
        setCatalogLoading(false);
      }
    };

    loadCatalog();
  }, [isOpen]);

  // Handle ESC key
  useEffect(() => {
    if (!isOpen && !selectedGameId && !adIframeUrl) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (adIframeUrl) {
          handleAdIframeClose();
        } else if (selectedGameId) {
          handleIframeClose();
        } else {
          handleClose();
        }
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, selectedGameId, adIframeUrl]);

  // Focus trap
  useEffect(() => {
    if (!isOpen) return;

    // Store the previously focused element
    previousActiveElement.current = document.activeElement as HTMLElement;

    // Focus the modal
    if (modalRef.current) {
      modalRef.current.focus();
    }

    // Trap focus within modal
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const modal = modalRef.current;
      if (!modal) return;

      const focusableElements = modal.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleTab);
    return () => {
      document.removeEventListener('keydown', handleTab);
      // Restore focus to previous element
      previousActiveElement.current?.focus();
    };
  }, [isOpen]);

  // Prevent body scroll when modal or ad iframe is open
  useEffect(() => {
    if (isOpen || adIframeUrl) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, adIframeUrl]);

  const handleClose = useCallback(() => {
    console.log('Menu closed');
    onClose();
  }, [onClose]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  const handleGameSelect = (gameId: string, gameName: string) => {
    // Track menu game click if menuId is available
    if (menuId && gameName) {
      trackMenuGameClick(menuId, gameName, apiKey).catch(() => {
        // Silently fail - tracking is best effort
      });
    }
    
    handleClose();
    setSelectedGameId(gameId);
    setSelectedGameName(gameName);
    // Reset ad tracking when a new game is selected
    setAdFetched(false);
    setCurrentAdId(null);
    adFetchingRef.current = false;
    onGameOpen?.(gameName);
  };

  const handleAdIdReceived = (adId: string) => {
    setCurrentAdId(adId);
  };

  const handleIframeClose = async () => {
    // Prevent multiple simultaneous ad fetches (e.g., from spam clicking close)
    if (adFetchingRef.current) {
      return;
    }
    
    if (!adFetched) {
      // Make API request and fetch / display ad.html here
      if (currentAdId) {
        adFetchingRef.current = true;
        try {
          const iframeUrl = await fetchAdForMinigame(currentAdId);
          if (iframeUrl) {
            setAdIframeUrl(iframeUrl);
            setAdFetched(true);
            setSelectedGameId(null);
            adFetchingRef.current = false;
            return; // Ad will be shown, onGameClose will be called when ad closes
          }
        } catch (error) {
          console.error('Error fetching ad:', error);
          // If ad fetch fails, just close without showing ad
        }
        adFetchingRef.current = false;
      }
      // No ad to show - game closes here
      setSelectedGameId(null);
      onGameClose?.(selectedGameName ?? '');
    } else {
      // If ad has already been already fetched, just close so we don't double count impressions
      setSelectedGameId(null);
      onGameClose?.(selectedGameName ?? '');
    }
  };

  const handleAdIframeClose = () => {
    setAdIframeUrl(null);
    // Keep adFetched as true so we don't show another ad
    onGameClose?.(selectedGameName ?? '');
    setSelectedGameName(null);
  };

  const handleAdOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === adOverlayRef.current && (adCountdown === null || adCountdown === 0)) {
      handleAdIframeClose();
    }
  };

  if (!isOpen && !selectedGameId && !adIframeUrl) {
    return null;
  }

  return (
    <>
      {/* Game Iframe */}
      {selectedGameId && (
        <GameIframe
            gameId={selectedGameId}
            charID={charID}
            charName={charName}
            charImage={charImage}
            charDesc={charDesc}
            convId={convId}
            entryPoint={entryPoint}
            messages={messages}
            delegateChar={delegateChar}
            onClose={handleIframeClose}
            onAdIdReceived={handleAdIdReceived}
            menuId={menuId}
            playableHeight={appliedTheme.playableHeight}
            playableBorderColor={appliedTheme.playableBorderColor}
        />
      )}

      {/* Ad Iframe */}
      {adIframeUrl && (
        <div
          ref={adOverlayRef}
          onClick={handleAdOverlayClick}
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
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Ad iframe"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {adCountdown !== null && adCountdown > 0 ? (
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
                aria-label={`Ad closes in ${adCountdown} seconds`}
              >
                <style>{`
                  @keyframes simula-countdown-ring {
                    from { stroke-dashoffset: 0; }
                    to { stroke-dashoffset: 81.68; }
                  }
                `}</style>
                <svg
                  viewBox="0 0 32 32"
                  width="32"
                  height="32"
                  style={{ transform: 'rotate(90deg) scaleX(-1)' }}
                >
                  <circle
                    cx="16"
                    cy="16"
                    r="13"
                    fill="rgba(0, 0, 0, 0.4)"
                    stroke="none"
                  />
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
                      animation: 'simula-countdown-ring 5s linear forwards',
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
            ) : (
              <CloseButton
                onClick={handleAdIframeClose}
                ariaLabel="Close ad"
                style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 10000 }}
              />
            )}
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
          </div>
        </div>
      )}

      {/* Modal */}
      {isOpen && (
        <div
          onClick={handleBackdropClick}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 9998,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0',
            animation: 'fadeIn 0.2s ease-in',
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Mini game menu"
        >
          <style>{`
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes slideUp {
              from { transform: translateY(20px); opacity: 0; }
              to { transform: translateY(0); opacity: 1; }
            }
            @keyframes slideDown {
              from { transform: translateY(0); opacity: 1; }
              to { transform: translateY(20px); opacity: 0; }
            }
            .simula-modal-content {
              animation: slideUp 0.3s ease-out;
            }
            .simula-modal-content.closing {
              animation: slideDown 0.3s ease-out;
            }
            .simula-mobile-footer-spacer {
              display: none;
            }
            @media (max-width: 767px) {
              .simula-mobile-footer-spacer {
                display: block !important;
                flex-shrink: 0;
                height: 8px;
              }
              .simula-modal-content {
                width: 92vw !important;
                height: 85vh !important;
                gap: 12px !important;
                padding-top: 12px !important;
                padding-bottom: 16px !important;
              }
              .simula-menu-content {
                padding-top: 0 !important;
                padding-left: 0 !important;
                padding-right: 0 !important;
                margin-left: -10px !important;
                margin-right: -10px !important;
                width: calc(100% + 20px) !important;
                flex: 1 1 auto !important;
                min-height: 0 !important;
              }
              .simula-modal-header {
                gap: 14px !important;
                padding-top: 18px !important;
                padding-bottom: 0 !important;
                padding-left: 8px !important;
              }
              .simula-modal-header .simula-avatar {
                width: 72px !important;
                height: 72px !important;
                border-radius: 16px !important;
              }
              .simula-modal-header .simula-title {
                font-size: 18px !important;
              }
            }
            @media (min-width: 768px) {
              .simula-modal-content {
                width: 95vw !important;
                height: 90vh !important;
                gap: 0 !important;
                padding: 16px 20px 20px !important;
              }
              .simula-menu-content {
                flex: 1 1 auto !important;
                min-height: 0 !important;
              }
            }
          `}</style>
          <div
            ref={modalRef}
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            className="simula-modal-content"
            style={{
              backgroundColor: appliedTheme.backgroundColor || '#0b0b0f',
              backgroundImage: `
                radial-gradient(520px 320px at 12% 16%, rgba(96, 165, 250, 0.11), transparent 72%),
                radial-gradient(440px 260px at 86% 24%, rgba(59, 130, 246, 0.08), transparent 74%),
                radial-gradient(700px 500px at 52% calc(100% + 100px), rgba(56, 189, 248, 0.09), transparent 65%)
              `,
              backgroundRepeat: 'no-repeat',
              borderRadius: '24px',
              width: '90vw',
              height: '95vh',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '0',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.15)',
              overflow: 'hidden',
              position: 'relative',
              padding: '12px 10px 16px',
            }}
          >
            {/* Close Button - absolute positioned */}
            <button
              onClick={handleClose}
              style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                width: '28px',
                height: '28px',
                borderRadius: '999px',
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: appliedTheme.secondaryFontColor || 'rgba(255, 255, 255, 0.92)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                zIndex: 6,
                padding: 0,
              }}
              aria-label="Close menu"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M6 6L18 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"/>
                <path d="M18 6L6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"/>
              </svg>
            </button>

            {/* Header */}
            <div
              className="simula-modal-header"
              style={{
                display: 'grid',
                gridTemplateColumns: 'auto auto 1fr',
                alignItems: 'center',
                gap: '16px',
                padding: '10px 0 0 8px',
                position: 'relative',
                zIndex: 1,
                flexShrink: 0,
              }}
            >
              {/* Character Avatar */}
              <div
                className="simula-avatar"
                style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '24px',
                  overflow: 'hidden',
                  flexShrink: 0,
                  background: 'rgba(255, 255, 255, 0.08)',
                  boxShadow: '0 16px 34px rgba(0, 0, 0, 0.45)',
                  border: '2px solid rgba(120, 200, 255, 0.1)',
                  zIndex: 2,
                  position: 'relative',
                }}
              >
                {!imageError && charImage ? (
                  <img
                    src={charImage}
                    alt={charName}
                    onError={() => setImageError(true)}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block',
                      pointerEvents: 'none',
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '28px',
                      fontWeight: '600',
                      color: appliedTheme.titleFontColor,
                      fontFamily: appliedTheme.titleFont,
                    }}
                  >
                    {getInitials(charName)}
                  </div>
                )}
              </div>

              {/* Game Icon */}
              <div
                className="simula-game-icon"
                style={{
                  position: 'relative',
                  width: '56px',
                  height: '56px',
                  marginLeft: '-36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  zIndex: 1,
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    inset: '-12px',
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(192, 132, 252, 0.22) 0%, rgba(236, 72, 153, 0.12) 50%, transparent 78%)',
                    pointerEvents: 'none',
                  }}
                />
                <img
                  src={gameIconImage}
                  alt=""
                  aria-hidden="true"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    position: 'relative',
                    zIndex: 1,
                    pointerEvents: 'none',
                  }}
                />
              </div>

              {/* Header Text */}
              <div
                style={{
                  width: '100%',
                  minWidth: 0,
                }}
              >
                <h2
                  className="simula-title"
                  style={{
                    margin: 0,
                    fontSize: '19px',
                    fontWeight: 900,
                    letterSpacing: '-0.3px',
                    color: appliedTheme.titleFontColor,
                    fontFamily: appliedTheme.titleFont,
                    lineHeight: '1.2',
                  }}
                >
                  <div>Play a Game with</div>
                  <div style={{ color: appliedTheme.titleFontColor, opacity: 0.78, fontWeight: 800 }}>{charName}</div>
                </h2>
              </div>
            </div>

            {/* Game Grid Content */}
            <div
              style={{
                padding: '0',
                overflowY: 'visible',
                overflowX: 'visible',
                flex: 1,
                minHeight: 0,
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: catalogError || catalogLoading ? 'center' : 'stretch',
                justifyContent: 'center',
              }}
              className="simula-menu-content"
            >
              {catalogLoading ? (
                <div
                  style={{
                    textAlign: 'center',
                    color: appliedTheme.secondaryFontColor,
                    fontFamily: appliedTheme.secondaryFont,
                    fontSize: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '12px',
                  }}
                >
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      border: '3px solid rgba(255, 255, 255, 0.1)',
                      borderTop: `3px solid ${appliedTheme.titleFontColor}`,
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                    }}
                  />
                  <style>{`
                    @keyframes spin {
                      0% { transform: rotate(0deg); }
                      100% { transform: rotate(360deg); }
                    }
                  `}</style>
                  <span>Loading games...</span>
                </div>
              ) : catalogError ? (
                <div
                  style={{
                    textAlign: 'center',
                    color: appliedTheme.secondaryFontColor,
                    fontFamily: appliedTheme.secondaryFont,
                    fontSize: '14px',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '16px',
                  }}
                >
                  <div
                    style={{
                      width: '150px',
                      height: '150px',
                      borderRadius: '50%',
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: appliedTheme.backgroundColor || '#0b0b0f',
                    }}
                  >
                    <img
                      src={gamesUnavailableImage}
                      alt="Games unavailable"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                  </div>
                  <span>No games are available to play right now. Please check back later!</span>
                </div>
              ) : (
                <GameGrid
                  games={games}
                  maxGamesToShow={maxGamesToShow}
                  charID={charID}
                  theme={appliedTheme}
                  onGameSelect={handleGameSelect}
                  menuId={menuId}
                  navigationType={navigationType}
                />
              )}
            </div>

            {/* Spacing footer (mobile only) */}
            <div className="simula-mobile-footer-spacer" aria-hidden="true" />
          </div>
        </div>
      )}
    </>
  );
};

