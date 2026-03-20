import React, { useState } from 'react';
import { GameData } from '../../types';

interface CoverCardProps {
  game: GameData;
  onGameSelect: (gameId: string) => void;
  style?: React.CSSProperties;
}

const fallbackEmojis = ['🎲', '🎮', '🎰', '🧩', '🎯'];

export const CoverCard: React.FC<CoverCardProps> = ({ game, onGameSelect, style }) => {
  const [imageError, setImageError] = useState(false);
  const [usedFallbackIcon, setUsedFallbackIcon] = useState(false);
  const [randomEmoji] = useState(() =>
    fallbackEmojis[Math.floor(Math.random() * fallbackEmojis.length)]
  );

  const imageSrc = imageError
    ? (usedFallbackIcon ? null : game.iconUrl)
    : (game.gifCover || game.iconUrl);

  const handleImageError = () => {
    if (!imageError) {
      // First error: gifCover failed, try iconUrl
      setImageError(true);
    } else {
      // Second error: iconUrl also failed
      setUsedFallbackIcon(true);
    }
  };

  return (
    <div
      onClick={() => onGameSelect(game.id)}
      style={{
        position: 'relative',
        borderRadius: '18px',
        overflow: 'hidden',
        background: 'rgba(255, 255, 255, 0.06)',
        aspectRatio: '9 / 16',
        minHeight: '450px',
        cursor: 'pointer',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        border: '2px solid rgba(120, 200, 255, 0.1)',
        boxShadow: '0 14px 30px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.06)',
        ...style,
      }}
      role="button"
      tabIndex={0}
      aria-label={`Play ${game.name}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onGameSelect(game.id);
        }
      }}
    >
      {/* Cover Image */}
      {imageSrc ? (
        <img
          src={imageSrc}
          alt=""
          onError={handleImageError}
          draggable={false}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
            pointerEvents: 'none',
            zIndex: 0,
            transform: 'scale(1.04)',
            transformOrigin: 'center',
          }}
        />
      ) : (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '48px',
            background: 'rgba(255, 255, 255, 0.04)',
            zIndex: 0,
          }}
        >
          {game.iconFallback || randomEmoji}
        </div>
      )}

      {/* Dark gradient overlay */}
      <div
        style={{
          position: 'absolute',
          inset: '-2px',
          background: 'linear-gradient(to top, rgba(0, 0, 0, 0.95) 0%, rgba(0, 0, 0, 0.45) 25%, rgba(0, 0, 0, 0) 48%)',
          pointerEvents: 'none',
          zIndex: 1,
          borderRadius: '20px',
        }}
      />

      {/* Game title */}
      <div
        style={{
          position: 'absolute',
          left: '10px',
          right: '10px',
          bottom: '10px',
          color: '#ffffff',
          fontWeight: 800,
          fontSize: '17px',
          lineHeight: '1.15',
          textShadow: '0 10px 24px rgba(0, 0, 0, 0.65)',
          zIndex: 2,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {game.name}
      </div>
    </div>
  );
};
