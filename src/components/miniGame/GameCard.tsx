import React, { useState, useRef, useEffect } from 'react';
import { GameData, MiniGameTheme } from '../../types';

interface GameCardProps {
  game: GameData;
  charID: string;
  theme: MiniGameTheme;
  onGameSelect: (gameId: string) => void;
}

export const GameCard: React.FC<GameCardProps> = ({ game, charID, theme, onGameSelect }) => {
  const [showDescription, setShowDescription] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const cardRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Random fallback icon selection (5 game-related emojis)
  const fallbackIcons = ['🎲', '🎮', '🎰', '🧩', '🎯'];
  const [randomFallback] = useState(() => 
    fallbackIcons[Math.floor(Math.random() * fallbackIcons.length)]
  );

  const handleClick = () => {
    console.log('Game launched:', { gameId: game.id, charID });
    onGameSelect(game.id);
  };

  const iconBorderRadius = theme.iconCornerRadius !== undefined 
    ? (theme.iconCornerRadius === 0 ? '0' : `${theme.iconCornerRadius}px`)
    : '8px';

  // Position tooltip above card, or below if not enough space
  useEffect(() => {
    if (showDescription && cardRef.current && tooltipRef.current) {
      const cardRect = cardRef.current.getBoundingClientRect();
      const tooltipHeight = tooltipRef.current.offsetHeight;
      const spaceAbove = cardRect.top;
      const spaceBelow = window.innerHeight - cardRect.bottom;
      
      const arrow = tooltipRef.current.querySelector('.tooltip-arrow') as HTMLElement;
      
      if (spaceAbove < tooltipHeight + 8 && spaceBelow > spaceAbove) {
        // Position below card
        tooltipRef.current.style.top = '100%';
        tooltipRef.current.style.bottom = 'auto';
        tooltipRef.current.style.marginTop = '8px';
        tooltipRef.current.style.marginBottom = '0';
        // Update arrow position
        if (arrow) {
          arrow.style.top = '-4px';
          arrow.style.bottom = 'auto';
          arrow.style.borderTop = 'none';
          arrow.style.borderBottom = '4px solid #1F2937';
        }
      } else {
        // Position above card (default)
        tooltipRef.current.style.top = 'auto';
        tooltipRef.current.style.bottom = '100%';
        tooltipRef.current.style.marginTop = '0';
        tooltipRef.current.style.marginBottom = '8px';
        // Update arrow position
        if (arrow) {
          arrow.style.top = 'auto';
          arrow.style.bottom = '-4px';
          arrow.style.borderTop = '4px solid #1F2937';
          arrow.style.borderBottom = 'none';
        }
      }
    }
  }, [showDescription]);

  return (
    <div
      ref={cardRef}
      onClick={handleClick}
      onMouseEnter={() => setShowDescription(true)}
      onMouseLeave={() => setShowDescription(false)}
      className="game-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        padding: '16px',
        paddingTop: '16px',
        cursor: 'pointer',
        borderRadius: '12px',
        backgroundColor: theme.backgroundColor || '#FFFFFF',
        border: `1px solid ${theme.borderColor || 'rgba(0, 0, 0, 0.08)'}`,
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        position: 'relative',
        minHeight: '140px',
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.transform = 'scale(1.05)';
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
        e.currentTarget.style.boxShadow = 'none';
      }}
      role="button"
      tabIndex={0}
      aria-label={`Play ${game.name}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      <style>{`
        .game-card {
          padding: 16px;
          padding-top: 16px;
          min-height: 140px;
        }
        .game-icon-container {
          width: 80px;
          height: 80px;
          font-size: 80px;
          margin-bottom: 12px;
          flex-shrink: 0;
          margin-top: 0;
        }
        .game-icon-container span {
          font-size: 80px;
          line-height: 1;
        }
        .game-name {
          font-size: 14px;
          width: 100%;
          flex: 1;
          display: flex;
          align-items: flex-start;
          justify-content: center;
        }
        @media (max-width: 639px) {
          .game-card {
            padding: 10px;
            padding-top: 10px;
            min-height: 100px;
          }
          .game-icon-container {
            width: 50px;
            height: 50px;
            font-size: 50px;
            margin-bottom: 8px;
          }
          .game-icon-container span {
            font-size: 50px;
          }
          .game-name {
            font-size: 11px;
          }
        }
      `}</style>
      {/* Game Icon */}
      <div
        className="game-icon-container"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.backgroundColor || 'transparent',
          borderRadius: iconBorderRadius,
          lineHeight: '1',
          overflow: 'hidden',
        }}
      >
        {imageError ? (
          <span style={{ 
            fontSize: '100%',
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: '1',
          }}>
            {game.iconFallback || randomFallback}
          </span>
        ) : (
          <>
            {imageLoading && (
              <div
                style={{
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: theme.backgroundColor || 'transparent',
                }}
              >
                <div
                  style={{
                    width: '24px',
                    height: '24px',
                    border: '2px solid rgba(0, 0, 0, 0.1)',
                    borderTop: `2px solid ${theme.titleFontColor || '#1F2937'}`,
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                  }}
                />
              </div>
            )}
            <img 
              src={game.iconUrl}
              alt={game.name}
              onLoad={() => setImageLoading(false)}
              onError={() => {
                setImageError(true);
                setImageLoading(false);
              }}
              style={{ 
                width: '100%', 
                height: '100%', 
                objectFit: 'cover',
                borderRadius: iconBorderRadius,
                display: imageLoading ? 'none' : 'block',
              }}
            />
          </>
        )}
      </div>

      {/* Game Name */}
      <div
        className="game-name"
        style={{
          fontWeight: '500',
          color: theme.titleFontColor || '#1F2937',
          textAlign: 'center',
          fontFamily: theme.titleFont || 'Inter, system-ui, sans-serif',
        }}
      >
        {game.name}
      </div>

      {/* Hover Description Overlay - Commented out for now */}
      {/* {showDescription && (
        <div
          ref={tooltipRef}
          style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginBottom: '8px',
            padding: '8px 12px',
            backgroundColor: '#1F2937',
            color: '#FFFFFF',
            borderRadius: '6px',
            fontSize: '12px',
            whiteSpace: 'normal',
            wordWrap: 'break-word',
            overflowWrap: 'break-word',
            maxWidth: '250px',
            minWidth: '150px',
            zIndex: 10001,
            pointerEvents: 'none',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
          }}
        >
          {game.description}
          <div
            className="tooltip-arrow"
            style={{
              position: 'absolute',
              bottom: '-4px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: '4px solid transparent',
              borderRight: '4px solid transparent',
              borderTop: '4px solid #1F2937',
            }}
          />
        </div>
      )} */}
    </div>
  );
};

