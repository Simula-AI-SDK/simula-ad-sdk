import React, { useState } from 'react';

interface CloseButtonProps {
  onClick: () => void;
  size?: number;
  backgroundColor?: string;
  contentColor?: string;
  hoverBackgroundColor?: string;
  hoverContentColor?: string;
  opacity?: number;
  hoverOpacity?: number;
  shape?: 'circle' | 'rounded';
  fontSize?: number;
  style?: React.CSSProperties;
  ariaLabel?: string;
}

/**
 * Shared close button matching the Kotlin SDK's CloseButton composable.
 * Defaults: 32px circle, dark semi-transparent background, white "✕".
 */
export const CloseButton: React.FC<CloseButtonProps> = ({
  onClick,
  size = 32,
  backgroundColor = 'rgba(0, 0, 0, 0.6)',
  contentColor = '#FFFFFF',
  hoverBackgroundColor,
  hoverContentColor,
  opacity,
  hoverOpacity,
  shape = 'circle',
  fontSize = 18,
  style,
  ariaLabel = 'Close',
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const currentBg = isHovered && hoverBackgroundColor ? hoverBackgroundColor : backgroundColor;
  const currentColor = isHovered && hoverContentColor ? hoverContentColor : contentColor;
  const currentOpacity = isHovered && hoverOpacity !== undefined ? hoverOpacity : opacity;

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onTouchStart={(e) => {
        e.stopPropagation();
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      aria-label={ariaLabel}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        minWidth: `${size}px`,
        minHeight: `${size}px`,
        background: currentBg,
        color: currentColor,
        opacity: currentOpacity,
        border: 'none',
        borderRadius: shape === 'circle' ? '50%' : '4px',
        fontSize: `${fontSize}px`,
        fontWeight: 'normal',
        lineHeight: 1,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        transition: 'background-color 0.2s ease, color 0.2s ease, opacity 0.2s ease',
        touchAction: 'manipulation',
        WebkitTapHighlightColor: 'transparent',
        userSelect: 'none',
        ...style,
      }}
    >
      {'\u2715'}
    </button>
  );
};
