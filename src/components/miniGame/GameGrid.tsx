import React, { useState, useMemo } from 'react';
import { GameData, MiniGameTheme } from '../../types';
import { GameCard } from './GameCard';

interface GameGridProps {
  games: GameData[];
  maxGamesToShow: 3 | 6 | 9;
  charID: string;
  theme: MiniGameTheme;
  onGameSelect: (gameId: string) => void;
}

export const GameGrid: React.FC<GameGridProps> = ({
  games,
  maxGamesToShow,
  charID,
  theme,
  onGameSelect,
}) => {
  const [currentPage, setCurrentPage] = useState(0);

  const totalPages = useMemo(() => {
    return Math.ceil(games.length / maxGamesToShow);
  }, [games.length, maxGamesToShow]);

  const currentGames = useMemo(() => {
    const start = currentPage * maxGamesToShow;
    const end = start + maxGamesToShow;
    return games.slice(start, end);
  }, [games, currentPage, maxGamesToShow]);

  const handlePrevious = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1);
    }
  };

  const showPagination = totalPages > 1;
  const canGoPrevious = currentPage > 0;
  const canGoNext = currentPage < totalPages - 1;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}
    >
      {/* Game Grid */}
      <div
        className="game-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '12px',
          width: '100%',
        }}
      >
        <style>{`
          .game-grid {
            gap: 12px;
          }
          @media (max-width: 639px) {
            .game-grid {
              gap: 8px;
            }
          }
        `}</style>
        {currentGames.map((game) => (
          <GameCard
            key={game.id}
            game={game}
            charID={charID}
            theme={theme}
            onGameSelect={onGameSelect}
          />
        ))}
      </div>

      {/* Pagination */}
      {showPagination && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
            marginTop: '8px',
          }}
        >
          <button
            onClick={handlePrevious}
            disabled={!canGoPrevious}
            style={{
              background: canGoPrevious
                ? (theme.backgroundColor || '#E5E7EB')
                : '#E5E7EB',
              color: canGoPrevious ? '#FFFFFF' : '#9CA3AF',
              border: 'none',
              borderRadius: '8px',
              width: '40px',
              height: '40px',
              cursor: canGoPrevious ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              transition: 'background-color 0.2s ease, opacity 0.2s ease',
              opacity: canGoPrevious ? 1 : 0.5,
            }}
            onMouseEnter={(e) => {
              if (canGoPrevious) {
                e.currentTarget.style.opacity = '0.8';
              }
            }}
            onMouseLeave={(e) => {
              if (canGoPrevious) {
                e.currentTarget.style.opacity = '1';
              }
            }}
            aria-label="Previous page"
            aria-disabled={!canGoPrevious}
          >
            ←
          </button>

          <span
            style={{
              fontSize: '14px',
              color: theme.secondaryFontColor || '#6B7280',
              fontFamily: theme.secondaryFont || 'Inter, system-ui, sans-serif',
            }}
          >
            {currentPage + 1} / {totalPages}
          </span>

          <button
            onClick={handleNext}
            disabled={!canGoNext}
            style={{
              background: canGoNext
                ? (theme.backgroundColor || '#E5E7EB')
                : '#E5E7EB',
              color: canGoNext ? '#FFFFFF' : '#9CA3AF',
              border: 'none',
              borderRadius: '8px',
              width: '40px',
              height: '40px',
              cursor: canGoNext ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              transition: 'background-color 0.2s ease, opacity 0.2s ease',
              opacity: canGoNext ? 1 : 0.5,
            }}
            onMouseEnter={(e) => {
              if (canGoNext) {
                e.currentTarget.style.opacity = '0.8';
              }
            }}
            onMouseLeave={(e) => {
              if (canGoNext) {
                e.currentTarget.style.opacity = '1';
              }
            }}
            aria-label="Next page"
            aria-disabled={!canGoNext}
          >
            →
          </button>
        </div>
      )}
    </div>
  );
};

