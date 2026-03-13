import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { GameData, MiniGameTheme } from '../../types';
import { GameCard } from './GameCard';

const MAX_VISIBLE_DOTS = 5;
const DOT_SIZE_CURRENT = 8;
const DOT_SIZE_ADJACENT = 6;
const DOT_SIZE_EDGE = 4;

interface GameGridProps {
  games: GameData[];
  maxGamesToShow: 3 | 6 | 9;
  charID: string;
  theme: MiniGameTheme;
  onGameSelect: (gameId: string, gameName: string) => void;
  menuId?: string | null;
  navigationType?: 'dot' | 'arrow' | 'pagination';
}

const calculateVisibleDots = (currentPage: number, totalPages: number) => {
  if (totalPages <= MAX_VISIBLE_DOTS) {
    return Array.from({ length: totalPages }, (_, i) => ({
      pageIndex: i,
      isVisible: true,
    }));
  }

  const halfWindow = Math.floor(MAX_VISIBLE_DOTS / 2);
  let startPage = currentPage - halfWindow;
  let endPage = currentPage + halfWindow;

  if (startPage < 0) {
    startPage = 0;
    endPage = MAX_VISIBLE_DOTS - 1;
  }

  if (endPage >= totalPages) {
    endPage = totalPages - 1;
    startPage = totalPages - MAX_VISIBLE_DOTS;
  }

  return Array.from({ length: MAX_VISIBLE_DOTS }, (_, i) => ({
    pageIndex: startPage + i,
    isVisible: true,
  }));
};

const getDotSize = (pageIndex: number, currentPage: number): number => {
  const distance = Math.abs(pageIndex - currentPage);
  if (distance === 0) return DOT_SIZE_CURRENT;
  if (distance === 1) return DOT_SIZE_ADJACENT;
  return DOT_SIZE_EDGE;
};

const getDotOpacity = (pageIndex: number, currentPage: number): number => {
  const distance = Math.abs(pageIndex - currentPage);
  if (distance === 0) return 1;
  if (distance === 1) return 0.5;
  return 0.3;
};

export const GameGrid: React.FC<GameGridProps> = ({
  games,
  maxGamesToShow,
  charID,
  theme,
  onGameSelect,
  menuId,
  navigationType = 'dot',
}) => {
  const [currentPage, setCurrentPage] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | null>(null);
  const [hoveredArrow, setHoveredArrow] = useState<'left' | 'right' | null>(null);

  const totalPages = useMemo(() => {
    return Math.ceil(games.length / maxGamesToShow);
  }, [games.length, maxGamesToShow]);

  // Reset to valid page if current page is out of bounds
  useEffect(() => {
    if (currentPage >= totalPages && totalPages > 0) {
      setCurrentPage(totalPages - 1);
    }
  }, [totalPages, currentPage]);

  const currentGames = useMemo(() => {
    const start = currentPage * maxGamesToShow;
    const end = start + maxGamesToShow;
    return games.slice(start, end);
  }, [games, currentPage, maxGamesToShow]);

  const visibleDots = useMemo(() => {
    return calculateVisibleDots(currentPage, totalPages);
  }, [currentPage, totalPages]);

  const animateToPage = useCallback((newPage: number, direction: 'left' | 'right') => {
    if (isAnimating) return;
    setIsAnimating(true);
    setSlideDirection(direction);

    // Wait for animation to complete
    setTimeout(() => {
      setCurrentPage(newPage);
      setSlideDirection(null);
      setIsAnimating(false);
    }, 250);
  }, [isAnimating]);

  const handleDotClick = (pageIndex: number) => {
    if (pageIndex === currentPage || isAnimating) return;
    const direction = pageIndex > currentPage ? 'left' : 'right';
    animateToPage(pageIndex, direction);
  };

  // Touch swipe support
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const gridContainerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (isAnimating) return;
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }, [isAnimating]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current || isAnimating) return;
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    touchStartRef.current = null;

    // Only trigger swipe if horizontal movement is dominant and exceeds threshold
    const SWIPE_THRESHOLD = 50;
    if (Math.abs(deltaX) < SWIPE_THRESHOLD || Math.abs(deltaY) > Math.abs(deltaX)) return;

    if (deltaX < 0 && currentPage < totalPages - 1) {
      // Swiped left → next page
      animateToPage(currentPage + 1, 'left');
    } else if (deltaX > 0 && currentPage > 0) {
      // Swiped right → previous page
      animateToPage(currentPage - 1, 'right');
    }
  }, [isAnimating, currentPage, totalPages, animateToPage]);

  const handlePrevPage = useCallback(() => {
    if (currentPage > 0 && !isAnimating) {
      animateToPage(currentPage - 1, 'right');
    }
  }, [currentPage, isAnimating, animateToPage]);

  const handleNextPage = useCallback(() => {
    if (currentPage < totalPages - 1 && !isAnimating) {
      animateToPage(currentPage + 1, 'left');
    }
  }, [currentPage, totalPages, isAnimating, animateToPage]);

  const showPagination = totalPages > 1;
  const accentColor = theme.accentColor || '#3B82F6';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        width: '100%',
      }}
    >
      <style>{`
        @keyframes slideOutLeft {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(-30%); opacity: 0; }
        }
        @keyframes slideOutRight {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(30%); opacity: 0; }
        }
        @keyframes slideInFromRight {
          from { transform: translateX(15%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideInFromLeft {
          from { transform: translateX(-15%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .game-grid-container {
          display: grid;
          gridTemplateColumns: repeat(3, 1fr);
          gap: 12px;
          width: 100%;
        }
        .game-grid-container.slide-left {
          animation: slideOutLeft 0.125s ease-out forwards;
        }
        .game-grid-container.slide-right {
          animation: slideOutRight 0.125s ease-out forwards;
        }
        .game-grid-container.slide-in-left {
          animation: slideInFromLeft 0.125s ease-out forwards;
        }
        .game-grid-container.slide-in-right {
          animation: slideInFromRight 0.125s ease-out forwards;
        }
        @media (max-width: 639px) {
          .game-grid-container {
            gap: 8px;
          }
        }
      `}</style>
      {/* Game Grid */}
      <div
        ref={gridContainerRef}
        className={`game-grid-container ${
          slideDirection === 'left' ? 'slide-left' :
          slideDirection === 'right' ? 'slide-right' : ''
        }`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '12px',
          width: '100%',
          touchAction: 'pan-y',
        }}
      >
        {currentGames.map((game) => (
          <GameCard
            key={game.id}
            game={game}
            charID={charID}
            theme={theme}
            onGameSelect={(gameId) => onGameSelect(gameId, game.name)}
            menuId={menuId}
          />
        ))}
      </div>

      {/* Pagination */}
      {showPagination && navigationType === 'dot' && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            marginTop: '4px',
            minHeight: '16px',
          }}
        >
          {visibleDots.map((dot) => {
            const size = getDotSize(dot.pageIndex, currentPage);
            const dotOpacity = getDotOpacity(dot.pageIndex, currentPage);
            const isCurrent = dot.pageIndex === currentPage;

            return (
              <button
                key={dot.pageIndex}
                onClick={() => handleDotClick(dot.pageIndex)}
                style={{
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'none',
                  border: 'none',
                  cursor: isCurrent ? 'default' : 'pointer',
                }}
                aria-label={`Page ${dot.pageIndex + 1} of ${totalPages}`}
                aria-current={isCurrent ? 'page' : undefined}
              >
                <span
                  style={{
                    width: `${size}px`,
                    height: `${size}px`,
                    borderRadius: '50%',
                    backgroundColor: accentColor,
                    opacity: dotOpacity,
                    display: 'block',
                    transition: 'all 0.2s ease',
                  }}
                />
              </button>
            );
          })}
        </div>
      )}

      {showPagination && navigationType === 'arrow' && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
            marginTop: '4px',
            minHeight: '16px',
          }}
        >
          <button
            onClick={handlePrevPage}
            onMouseEnter={() => setHoveredArrow('left')}
            onMouseLeave={() => setHoveredArrow(null)}
            disabled={currentPage === 0}
            style={{
              background: 'none',
              border: 'none',
              cursor: currentPage === 0 ? 'default' : 'pointer',
              opacity: currentPage === 0 ? 0.3 : hoveredArrow === 'left' ? 1 : 0.7,
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'opacity 0.2s ease',
            }}
            aria-label="Previous page"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button
            onClick={handleNextPage}
            onMouseEnter={() => setHoveredArrow('right')}
            onMouseLeave={() => setHoveredArrow(null)}
            disabled={currentPage === totalPages - 1}
            style={{
              background: 'none',
              border: 'none',
              cursor: currentPage === totalPages - 1 ? 'default' : 'pointer',
              opacity: currentPage === totalPages - 1 ? 0.3 : hoveredArrow === 'right' ? 1 : 0.7,
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'opacity 0.2s ease',
            }}
            aria-label="Next page"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      )}

      {showPagination && navigationType === 'pagination' && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            marginTop: '4px',
            minHeight: '16px',
            fontFamily: theme.secondaryFont || 'Inter, system-ui, sans-serif',
            fontSize: '13px',
          }}
        >
          <button
            onClick={handlePrevPage}
            onMouseEnter={() => setHoveredArrow('left')}
            onMouseLeave={() => setHoveredArrow(null)}
            disabled={currentPage === 0}
            style={{
              background: 'none',
              border: 'none',
              cursor: currentPage === 0 ? 'default' : 'pointer',
              opacity: currentPage === 0 ? 0.3 : hoveredArrow === 'left' ? 1 : 0.7,
              color: accentColor,
              fontFamily: 'inherit',
              fontSize: 'inherit',
              fontWeight: 500,
              padding: '4px 2px',
              transition: 'opacity 0.2s ease',
            }}
            aria-label="Previous page"
          >
            Prev
          </button>
          <span
            style={{
              color: theme.secondaryFontColor || '#6B7280',
              userSelect: 'none',
            }}
          >
            |
          </span>
          <span
            style={{
              color: theme.secondaryFontColor || '#6B7280',
              userSelect: 'none',
            }}
          >
            {currentPage + 1} / {totalPages}
          </span>
          <span
            style={{
              color: theme.secondaryFontColor || '#6B7280',
              userSelect: 'none',
            }}
          >
            |
          </span>
          <button
            onClick={handleNextPage}
            onMouseEnter={() => setHoveredArrow('right')}
            onMouseLeave={() => setHoveredArrow(null)}
            disabled={currentPage === totalPages - 1}
            style={{
              background: 'none',
              border: 'none',
              cursor: currentPage === totalPages - 1 ? 'default' : 'pointer',
              opacity: currentPage === totalPages - 1 ? 0.3 : hoveredArrow === 'right' ? 1 : 0.7,
              color: accentColor,
              fontFamily: 'inherit',
              fontSize: 'inherit',
              fontWeight: 500,
              padding: '4px 2px',
              transition: 'opacity 0.2s ease',
            }}
            aria-label="Next page"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

