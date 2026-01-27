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
}) => {
  const [currentPage, setCurrentPage] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | null>(null);

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
        className={`game-grid-container ${
          slideDirection === 'left' ? 'slide-left' : 
          slideDirection === 'right' ? 'slide-right' : ''
        }`}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '12px',
          width: '100%',
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

      {/* Dot Pagination */}
      {showPagination && (
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
    </div>
  );
};

