import { SimulaTheme, AccentOption, FontOption } from '../types';
import { 
  getColorTheme, 
  getFontStyles, 
  getSolidBackground,
  getTextMuted,
  getShadow
} from './colorThemes';

export const getResponsiveStyles = (theme: SimulaTheme = {}): React.CSSProperties => {
  const {
    theme: themeMode = 'light',
    accent = 'blue',
    font = 'san-serif',
    width = 'auto',
  } = theme;

  // If accent or font is an array, use the first value for styling
  const effectiveAccent: AccentOption = Array.isArray(accent) ? accent[0] : accent;
  const effectiveFont: FontOption = Array.isArray(font) ? font[0] : font;

  const colors = getColorTheme(themeMode, effectiveAccent);
  const fonts = getFontStyles(effectiveFont);

  return {
    '--simula-primary': colors.primary,
    '--simula-border': colors.border,
    '--simula-background': getSolidBackground(colors),
    '--simula-text': colors.text,
    '--simula-font-primary': fonts.primary,
    '--simula-width': typeof width === 'number' ? `${width}px` : width,
  } as React.CSSProperties;
};

export const createAdSlotCSS = (theme: SimulaTheme = {}) => {
  const {
    theme: themeMode = 'light',
    accent = 'blue',
    font = 'san-serif',
    width = 'auto',
  } = theme;

  // If accent or font is an array, use the first value for styling
  const effectiveAccent: AccentOption = Array.isArray(accent) ? accent[0] : accent;
  const effectiveFont: FontOption = Array.isArray(font) ? font[0] : font;

  const colors = getColorTheme(themeMode, effectiveAccent);
  const fonts = getFontStyles(effectiveFont);

  // Fixed dimensions
  const minWidth = 320;
  const fixedHeight = 265;

  // Handle width calculation
  const getWidthCSS = () => {
    if (width === 'auto') {
      return '100%';
    }
    if (typeof width === 'string') {
      // For percentage values and other CSS units, use as-is
      return width;
    }
    return `${width}px`;
  };

  return `
    .simula-content-slot {
      width: ${getWidthCSS()};
      min-width: ${minWidth}px;
      height: ${fixedHeight}px;
      margin: 0px;
      line-height: 1.5;
      position: relative;
      overflow: hidden;
    }

    .simula-content-slot * {
      margin: 0;
      padding: 0;
    }

    .simula-content-frame {
      width: 100%;
      height: 100%;
      border: none;
      outline: none;
      box-shadow: none;
      border-radius: 0;
      background: transparent;
      display: block;
      margin: 0;
      padding: 0;
      position: relative;
      vertical-align: top;
    }

    .simula-info-icon {
      position: absolute;
      top: 16px;
      right: 16px;
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
      width: 75%;
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

    .simula-content-label {
      font-size: 10px;
      color: ${getTextMuted(colors)};
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 8px;
      display: block;
    }
  `;
};