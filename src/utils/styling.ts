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
    mobileWidth = 'auto',
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
    '--simula-mobile-width': typeof mobileWidth === 'number' ? `${mobileWidth}px` : '100%',
    '--simula-mobile-breakpoint': `${mobileBreakpoint}px`,
  } as React.CSSProperties;
};

export const createAdSlotCSS = (theme: SimulaTheme = {}) => {
  const {
    theme: themeMode = 'light',
    accent = 'blue',
    font = 'san-serif',
    width = 'auto',
    mobileWidth = 'auto',
    mobileBreakpoint = 768,
  } = theme;

  const colors = getColorTheme(themeMode, accent);
  const fonts = getFontStyles(font);

  // Aspect ratio based on max size
  const maxWidth = 880;
  const minWidth = 420;
  const maxHeight = 225;
  const aspectRatio = 225 / 864; // ~0.35104
  const minHeight = minWidth * aspectRatio;

  const marginAdjustment = 16;

  // Handle width calculation
  const getWidthCSS = () => {
    if (width === 'auto') {
      return '100%';
    }
    if (typeof width === 'string') {
      // For percentage values and other CSS units, use as-is
      return width;
    }
    return `${width + marginAdjustment}px`;
  };

  // Handle height calculation
  const getHeightCSS = () => {
    if (width === 'auto') {
      return `clamp(${minHeight + marginAdjustment}px, ${aspectRatio * 100}vw, ${maxHeight + marginAdjustment}px)`;
    }
    if (typeof width === 'string') {
      // For percentage values and other CSS units, calculate height proportionally
      return `calc((${width}) * ${aspectRatio} + ${marginAdjustment}px)`;
    }
    return `${width * aspectRatio + marginAdjustment}px`;
  };

  // Handle mobile width calculation
  const getMobileWidthCSS = () => {
    if (mobileWidth === 'auto') {
      return '100%';
    }
    if (typeof mobileWidth === 'string') {
      // For percentage values and other CSS units, use as-is
      return mobileWidth;
    }
    return `${mobileWidth}px`;
  };

  const getMobileMinWidthCSS = () => {
    if (mobileWidth === 'auto') {
      return `${Math.min(320, minWidth)}px`;
    }
    return typeof mobileWidth === 'number' ? `${Math.min(400, mobileWidth)}px` : `${Math.min(400, 320)}px`;
  };

  return `
    .simula-ad-slot {
      width: ${getWidthCSS()};
      max-width: ${maxWidth  + marginAdjustment}px;
      min-width: ${minWidth + marginAdjustment}px;
      margin: 16px 0;
      font-family: ${fonts.primary};
      line-height: 1.5;
      position: relative;
      overflow: hidden;
      max-height: ${maxHeight + marginAdjustment}px;
      min-height: ${minHeight + marginAdjustment}px;
      height: ${getHeightCSS()};
    }

    .simula-ad-slot * {
      margin: 0;
      padding: 0;
    }

    .simula-ad-iframe {
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

    /* Optional: visual error state if width < ${minWidth}px (toggle this class at runtime) */
    .simula-ad-slot.too-narrow .simula-ad-iframe {
      display: none;
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
        width: ${getMobileWidthCSS()};
        min-width: ${getMobileMinWidthCSS()};
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