import { SimulaTheme } from '../types';
import { 
  getColorTheme, 
  getFontStyles, 
  getBackgroundGradient, 
  getSolidBackground,
  getTextMuted,
  getTextSecondary,
  getBorderLight,
  getShadow
} from './colorThemes';

export const getResponsiveStyles = (theme: SimulaTheme = {}): React.CSSProperties => {
  const {
    theme: themeMode = 'light',
    accent = 'blue',
    font = 'san-serif',
    width = 'auto',
    mobileWidth = 320,
    minWidth = 280,
    mobileBreakpoint = 768,
  } = theme;

  const colors = getColorTheme(themeMode, accent);
  const fonts = getFontStyles(font);

  return {
    '--simula-primary': colors.primary,
    '--simula-secondary': colors.secondary,
    '--simula-border': colors.border,
    '--simula-background': getSolidBackground(colors),
    '--simula-text': colors.text,
    '--simula-font-primary': fonts.primary,
    '--simula-width': typeof width === 'number' ? `${width}px` : width,
    '--simula-mobile-width': `${mobileWidth}px`,
    '--simula-min-width': `${minWidth}px`,
    '--simula-mobile-breakpoint': `${mobileBreakpoint}px`,
  } as React.CSSProperties;
};

export const createAdSlotCSS = (theme: SimulaTheme = {}) => {
  const {
    theme: themeMode = 'light',
    accent = 'blue',
    font = 'san-serif',
    width = 'auto',
    mobileWidth = 320,
    minWidth = 280,
    mobileBreakpoint = 768,
  } = theme;

  const colors = getColorTheme(themeMode, accent);
  const fonts = getFontStyles(font);

  return `
    .simula-ad-slot {
      width: ${typeof width === 'number' ? `${width}px` : width};
      max-width: 862px;
      min-width: ${minWidth}px;
      margin: 16px 0;
      font-family: ${fonts.primary};
      line-height: 1.5;
      position: relative;
    }

    .simula-ad-iframe {
      width: 100%;
      max-width: 862px;
      height: 300px;
      border: none;
      border-radius: 6px;
      background: transparent;
    }

    .simula-info-icon {
      position: absolute;
      bottom: 8px;
      right: 8px;
      background: none;
      border: none;
      color: ${getTextMuted(colors)};
      opacity: 0.5;
      cursor: pointer;
      padding: 4px;
      border-radius: 50%;
      transition: opacity 0.2s ease;
      z-index: 10;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .simula-info-icon:hover {
      opacity: 0.8;
    }

    .simula-modal-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .simula-modal-content {
      background: ${getSolidBackground(colors)};
      border-radius: 8px;
      padding: 16px;
      width: 50%;
      min-width: 200px;
      max-width: 431px;
      margin: 16px;
      position: relative;
      box-shadow: 0 4px 12px ${getShadow(colors)};
      font-family: ${fonts.primary};
      line-height: 1.5;
      color: ${colors.text};
      font-size: 14px;
      border: 1px solid ${colors.border};
    }

    .simula-modal-close {
      position: absolute;
      top: 8px;
      right: 12px;
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: ${getTextMuted(colors)};
      padding: 4px;
      line-height: 1;
    }

    .simula-modal-close:hover {
      color: ${colors.text};
    }

    .simula-modal-link {
      color: ${colors.primary};
      text-decoration: underline;
    }

    .simula-modal-link:hover {
      color: ${colors.primaryHover};
      text-decoration: underline;
    }

    .simula-ad-label {
      font-size: 10px;
      color: ${getTextMuted(colors)};
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 8px;
      display: block;
    }

    @media (max-width: ${mobileBreakpoint}px) {
      .simula-ad-slot {
        width: ${mobileWidth}px;
        min-width: ${Math.min(minWidth, mobileWidth)}px;
        margin: 12px 0;
      }

      .simula-modal-content {
        width: 90%;
        max-width: none;
        margin: 12px;
        padding: 12px;
      }
    }
  `;
};