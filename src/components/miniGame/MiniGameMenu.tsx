import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MiniGameMenuProps, MiniGameTheme, GameData } from '../../types';
import { GameGrid } from './GameGrid';
import { GameIframe } from './GameIframe';
import { mockGames } from './mockGames';
import { fetchCatalog } from '../../utils/api';

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
}) => {
  const [catalog, setCatalog] = useState<GameData[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Fetch catalog from API
  useEffect(() => {
    const loadCatalog = async () => {
      try {
        const data = await fetchCatalog();
        setCatalog(data);
      } catch (error) {
        console.error('Error loading catalog:', error);
        // Fallback to mock games if API fails
        setCatalog(mockGames);
      }
    };
    loadCatalog();
  }, []);

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

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedGameId) {
          setSelectedGameId(null);
        } else {
          handleClose();
        }
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, selectedGameId]);

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

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

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
  };

  const handleIframeClose = () => {
    setSelectedGameId(null);
  };

  if (!isOpen && !selectedGameId) {
    return null;
  }

  return (
    <>
      {/* Game Iframe */}
      {selectedGameId && (
        <GameIframe gameId={selectedGameId} charID={charID} onClose={handleIframeClose} />
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
              }}
            >
              <GameGrid
                games={catalog}
                maxGamesToShow={maxGamesToShow}
                charID={charID}
                theme={appliedTheme}
                onGameSelect={handleGameSelect}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

