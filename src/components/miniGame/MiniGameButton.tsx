import React from 'react';
import { MiniGameButtonProps, MiniGameButtonTheme } from '../../types';
import { toWidthCSS } from '../../utils/parseWidth';

const defaultTheme: Required<MiniGameButtonTheme> = {
  cornerRadius: 8,
  backgroundColor: '#3B82F6',
  textColor: '#FFFFFF',
  fontSize: 14,
  padding: '10px 20px',
  borderWidth: 0,
  borderColor: 'transparent',
  pulsateColor: '',
  badgeColor: '#EF4444',
  fontFamily: 'Inter, system-ui, sans-serif',
};

export const MiniGameButton: React.FC<MiniGameButtonProps> = ({
  text,
  showPulsate = false,
  showBadge = false,
  theme = {},
  width,
  onClick,
}) => {
  const appliedTheme = { ...defaultTheme, ...theme };
  const hasWidth = width !== undefined;

  const paddingValue =
    typeof appliedTheme.padding === 'number'
      ? `${appliedTheme.padding}px`
      : appliedTheme.padding;

  const displayText = text ?? '\uD83C\uDFAE Play a Game';
  const pulsateColor = appliedTheme.pulsateColor || appliedTheme.backgroundColor;
  const badgeColor = appliedTheme.badgeColor;

  return (
      <div style={{ position: 'relative', display: 'inline-flex', ...(hasWidth ? { width: toWidthCSS(width) } : {}) }}>
      {(showPulsate || showBadge) && (
        <style>{`
          ${showPulsate ? `
          @keyframes miniGameButtonPulsate {
            0% { box-shadow: 0 0 0 0 ${pulsateColor}CC; }
            70% { box-shadow: 0 0 0 12px ${pulsateColor}00; }
            100% { box-shadow: 0 0 0 0 ${pulsateColor}00; }
          }` : ''}
          ${showBadge ? `
          @keyframes miniGameBadgePing {
            75%, 100% { transform: scale(2); opacity: 0; }
          }` : ''}
        `}</style>
      )}
      <button
        onClick={onClick}
        style={{
          backgroundColor: appliedTheme.backgroundColor,
          color: appliedTheme.textColor,
          borderRadius: `${appliedTheme.cornerRadius}px`,
          padding: paddingValue,
          border: appliedTheme.borderWidth ? `${appliedTheme.borderWidth}px solid ${appliedTheme.borderColor}` : 'none',
          cursor: 'pointer',
          fontSize: `${appliedTheme.fontSize}px`,
          fontWeight: 600,
          fontFamily: 'Inter, system-ui, sans-serif',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          ...(hasWidth ? { width: '100%' } : {}),
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
              backgroundColor: badgeColor,
              animation: 'miniGameBadgePing 1s cubic-bezier(0, 0, 0.2, 1) infinite',
            }}
          />
          <span
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: badgeColor,
            }}
          />
        </span>
      )}
      </div>
  );
};
