import React from 'react';
import { MiniGameButtonProps, MiniGameButtonTheme } from '../../types';

const defaultTheme: Required<MiniGameButtonTheme> = {
  cornerRadius: 8,
  primaryColor: '#3B82F6',
  fontColor: '#FFFFFF',
  padding: '10px 20px',
};

export const MiniGameButton: React.FC<MiniGameButtonProps> = ({
  text,
  showPulsate = false,
  showBadge = false,
  theme = {},
  onClick,
}) => {
  const appliedTheme = { ...defaultTheme, ...theme };

  const paddingValue =
    typeof appliedTheme.padding === 'number'
      ? `${appliedTheme.padding}px`
      : appliedTheme.padding;

  const displayText = text ?? '\uD83C\uDFAE Play a Game';

  return (
    <>
      {(showPulsate || showBadge) && (
        <style>{`
          ${showPulsate ? `
          @keyframes miniGameButtonPulsate {
            0% { box-shadow: 0 0 0 0 ${appliedTheme.primaryColor}80; }
            70% { box-shadow: 0 0 0 10px ${appliedTheme.primaryColor}00; }
            100% { box-shadow: 0 0 0 0 ${appliedTheme.primaryColor}00; }
          }` : ''}
          ${showBadge ? `
          @keyframes miniGameBadgePing {
            75%, 100% { transform: scale(2); opacity: 0; }
          }` : ''}
        `}</style>
      )}
      <div style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        onClick={onClick}
        style={{
          backgroundColor: appliedTheme.primaryColor,
          color: appliedTheme.fontColor,
          borderRadius: `${appliedTheme.cornerRadius}px`,
          padding: paddingValue,
          border: 'none',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: 600,
          fontFamily: 'Inter, system-ui, sans-serif',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          transition: 'opacity 0.2s ease, transform 0.1s ease',
          ...(showPulsate
            ? { animation: 'miniGameButtonPulsate 2s ease-in-out infinite' }
            : {}),
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = '0.9';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = '1';
          e.currentTarget.style.transform = 'scale(1)';
        }}
        onMouseDown={(e) => {
          e.currentTarget.style.transform = 'scale(0.97)';
        }}
        onMouseUp={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
        }}
        aria-label={typeof displayText === 'string' ? displayText : 'Play a Game'}
      >
        {displayText}
      </button>
      {showBadge && (
        <span
          style={{
            position: 'absolute',
            top: '-4px',
            right: '-4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span
            style={{
              position: 'absolute',
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: '#EF4444',
              animation: 'miniGameBadgePing 1s cubic-bezier(0, 0, 0.2, 1) infinite',
            }}
          />
          <span
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: '#EF4444',
            }}
          />
        </span>
      )}
      </div>
    </>
  );
};
