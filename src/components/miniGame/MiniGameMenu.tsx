import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MiniGameMenuProps, MiniGameTheme, GameData } from '../../types';
import { GameGrid } from './GameGrid';
import { GameIframe } from './GameIframe';
import { fetchCatalog, fetchAdForMinigame } from '../../utils/api';
import gamesUnavailableImage from '../../assets/games-unavailable.png';

const defaultTheme: Omit<Required<MiniGameTheme>, 'backgroundColor' | 'headerColor' | 'borderColor'> & { backgroundColor?: string; headerColor?: string; borderColor?: string } = {
  titleFont: 'Inter, system-ui, sans-serif',
  secondaryFont: 'Inter, system-ui, sans-serif',
  titleFontColor: '#1F2937',
  secondaryFontColor: '#6B7280',
  iconCornerRadius: 8,
  borderColor: 'rgba(0, 0, 0, 0.08)',
};

export const MiniGameMenu: React.FC<MiniGameMenuProps> = ({
  isOpen,
  onClose,
  charName,
  charID,
  charImage,
  messages = [],
  charDesc,
  maxGamesToShow = 6,
  theme = {},
  delegateCharacter = true,
}) => {
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const [games, setGames] = useState<GameData[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState(false);
  const [adFetched, setAdFetched] = useState(false);
  const [adIframeUrl, setAdIframeUrl] = useState<string | null>(null);
  const [currentAdId, setCurrentAdId] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const adOverlayRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Merge theme with defaults
  const appliedTheme: Omit<Required<MiniGameTheme>, 'backgroundColor' | 'headerColor' | 'borderColor'> & { backgroundColor?: string; headerColor?: string; borderColor?: string } = {
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
        const catalogData = await fetchCatalog();
        setGames(catalogData);
      } catch (error) {
        console.error('Failed to load game catalog:', error);
        setCatalogError(true);
        setGames([]);
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

  const handleGameSelect = (gameId: string) => {
    handleClose();
    setSelectedGameId(gameId);
    // Reset ad tracking when a new game is selected
    setAdFetched(false);
    setCurrentAdId(null);
  };

  const handleAdIdReceived = (adId: string) => {
    setCurrentAdId(adId);
  };

  const handleIframeClose = async () => {
    if (!adFetched) {
      // Make API request and fetch / display ad.html here
      if (currentAdId) {
        try {
          const iframeUrl = await fetchAdForMinigame(currentAdId);
          if (iframeUrl) {
            setAdIframeUrl(iframeUrl);
            setAdFetched(true);
          }
        } catch (error) {
          console.error('Error fetching ad:', error);
          // If ad fetch fails, just close without showing ad
        }
      }
      setSelectedGameId(null);
    } else {
      // If ad has already been already fetched, just close so we don't double count impressions
      setSelectedGameId(null);
    }
  };

  const handleAdIframeClose = () => {
    setAdIframeUrl(null);
    // Keep adFetched as true so we don't show another ad
  };

  const handleAdOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === adOverlayRef.current) {
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
            messages={messages}
            delegateCharacter={delegateCharacter}
            onClose={handleIframeClose}
            onAdIdReceived={handleAdIdReceived}
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
            <button
              onClick={handleAdIframeClose}
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
              aria-label="Close ad"
            >
              ×
            </button>
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
            padding: '16px',
            animation: 'fadeIn 0.2s ease-in',
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Mini game menu"
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
                transform: translateY(20px);
                opacity: 0;
              }
              to {
                transform: translateY(0);
                opacity: 1;
              }
            }
            @keyframes slideDown {
              from {
                transform: translateY(0);
                opacity: 1;
              }
              to {
                transform: translateY(20px);
                opacity: 0;
              }
            }
            .modal-content {
              animation: slideUp 0.3s ease-out;
            }
            .modal-content.closing {
              animation: slideDown 0.3s ease-out;
            }
          `}</style>
          <div
            ref={modalRef}
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            className="modal-content"
            style={{
              backgroundColor: appliedTheme.backgroundColor || '#FFFFFF',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '600px',
              minWidth: '320px',
              minHeight: '400px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '20px',
                borderBottom: `1px solid ${appliedTheme.borderColor}`,
                position: 'relative',
                zIndex: 1,
                isolation: 'isolate',
                backgroundColor: appliedTheme.headerColor,
              }}
            >
              {/* Character Avatar */}
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  backgroundColor: appliedTheme.backgroundColor,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  flexShrink: 0,
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
                    }}
                  />
                ) : (
                  <span
                    style={{
                      fontSize: '16px',
                      fontWeight: '600',
                      color: appliedTheme.backgroundColor,
                      fontFamily: appliedTheme.titleFont,
                    }}
                  >
                    {getInitials(charName)}
                  </span>
                )}
              </div>

              {/* Header Text */}
              <div style={{ flex: 1 }}>
                <h2
                  style={{
                    margin: 0,
                    fontSize: '18px',
                    fontWeight: '600',
                    color: appliedTheme.titleFontColor,
                    fontFamily: appliedTheme.titleFont,
                    lineHeight: '1.2',
                  }}
                >
                  Play a Game with {charName}
                </h2>
              </div>

              {/* Close Button */}
              <button
                onClick={handleClose}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: appliedTheme.secondaryFontColor,
                  padding: '4px',
                  lineHeight: '1',
                  borderRadius: '4px',
                  transition: 'background-color 0.2s ease, color 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '32px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#F3F4F6';
                  e.currentTarget.style.color = appliedTheme.titleFontColor;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = appliedTheme.secondaryFontColor;
                }}
                aria-label="Close menu"
              >
                ×
              </button>
            </div>

            {/* Game Grid Content */}
            <div
              style={{
                padding: '20px',
                overflowY: 'visible',
                overflowX: 'visible',
                flex: 1,
                position: 'relative',
                display: 'flex',
                alignItems: catalogError || catalogLoading ? 'center' : 'flex-start',
                justifyContent: catalogError || catalogLoading ? 'center' : 'flex-start',
              }}
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
                      border: '3px solid rgba(0, 0, 0, 0.1)',
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
                      backgroundColor: appliedTheme.backgroundColor || '#F3F4F6',
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
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

