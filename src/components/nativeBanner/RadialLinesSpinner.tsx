import React, { useState, useEffect } from 'react';

/**
 * Radial lines spinner component (matching Flutter SDK).
 * Displays 12 radial lines that animate around a circle.
 */
export const RadialLinesSpinner: React.FC = () => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => (prev + 1 / 12) % 1);
    }, 100); // 1200ms / 12 lines = 100ms per line
    return () => clearInterval(interval);
  }, []);

  const lineCount = 12;
  const radius = 8;
  const lineLength = radius * 0.6;
  const currentLine = Math.floor(progress * lineCount) % lineCount;

  return (
    <svg width="16" height="16" viewBox="0 0 16 16">
      {Array.from({ length: lineCount }).map((_, i) => {
        const angle = (i * 2 * Math.PI) / lineCount;
        const distance = (i - currentLine + lineCount) % lineCount;

        let opacity = 0.35;
        if (distance === 0) opacity = 1.0;
        else if (distance === 1) opacity = 0.75;
        else if (distance === 2) opacity = 0.5;
        else if (distance === 3) opacity = 0.4;

        const startX = 8 + (radius - lineLength) * Math.cos(angle);
        const startY = 8 + (radius - lineLength) * Math.sin(angle);
        const endX = 8 + radius * Math.cos(angle);
        const endY = 8 + radius * Math.sin(angle);

        return (
          <line
            key={i}
            x1={startX}
            y1={startY}
            x2={endX}
            y2={endY}
            stroke="black"
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity={opacity}
          />
        );
      })}
    </svg>
  );
};
