import { SimulaTheme } from '../types';

export const getResponsiveStyles = (theme: SimulaTheme = {}): React.CSSProperties => {
  const {
    primary = '#0EA5E9',
    secondary = '#0369A1',
    border = '#E2E8F0',
    width = 'auto',
    mobileWidth = 320,
    minWidth = 280,
    mobileBreakpoint = 768,
  } = theme;

  return {
    '--simula-primary': primary,
    '--simula-secondary': secondary,
    '--simula-border': border,
    '--simula-width': typeof width === 'number' ? `${width}px` : width,
    '--simula-mobile-width': `${mobileWidth}px`,
    '--simula-min-width': `${minWidth}px`,
    '--simula-mobile-breakpoint': `${mobileBreakpoint}px`,
  } as React.CSSProperties;
};

export const createAdSlotCSS = (theme: SimulaTheme = {}) => {
  const {
    primary = '#0EA5E9',
    secondary = '#0369A1',
    border = '#E2E8F0',
    width = 'auto',
    mobileWidth = 320,
    minWidth = 280,
    mobileBreakpoint = 768,
  } = theme;

  return `
    .simula-ad-slot {
      width: ${typeof width === 'number' ? `${width}px` : width};
      min-width: ${minWidth}px;
      margin: 16px 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.5;
      position: relative;
    }



    .simula-ad-iframe {
      width: 100%;
      height: 250px;
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
      color: #666;
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
      background: #ffffff;
      border-radius: 8px;
      padding: 16px;
      max-width: 280px;
      margin: 16px;
      position: relative;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.5;
      color: #333;
      font-size: 14px;
    }

    .simula-modal-close {
      position: absolute;
      top: 8px;
      right: 12px;
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: #666;
      padding: 4px;
      line-height: 1;
    }

    .simula-modal-close:hover {
      color: #000;
    }

    .simula-modal-link {
      color: inherit;
      text-decoration: underline;
    }

    .simula-modal-link:hover {
      text-decoration: underline;
    }

    .simula-ad-label {
      font-size: 10px;
      color: #9ca3af;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 8px;
      display: block;
    }



    @media (max-width: ${mobileBreakpoint}px) {
      .simula-ad-slot {
        width: ${mobileWidth}px;
        max-width: calc(100vw - 32px);
        margin: 12px 0;
      }
    }

    @media (max-width: 480px) {
      .simula-ad-slot {
        width: 100%;
        max-width: calc(100vw - 24px);
        margin: 8px 0;
      }
    }
  `;
};