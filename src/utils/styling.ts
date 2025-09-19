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
      border: 1px solid ${border};
      border-radius: 8px;
      padding: 16px;
      margin: 16px 0;
      background: #ffffff;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.5;
      transition: all 0.2s ease;
    }

    .simula-ad-slot:hover {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }



    .simula-ad-content {
      cursor: pointer;
      text-decoration: none;
      color: inherit;
      display: block;
    }

    .simula-ad-content:hover {
      text-decoration: none;
    }

    .simula-ad-iframe {
      width: 100%;
      height: 250px;
      border: none;
      border-radius: 6px;
      background: transparent;
    }

    .simula-ad-title {
      font-size: 16px;
      font-weight: 600;
      color: ${primary};
      margin-bottom: 8px;
      line-height: 1.4;
    }

    .simula-ad-description {
      font-size: 14px;
      color: #374151;
      margin-bottom: 12px;
      line-height: 1.5;
    }

    .simula-ad-cta {
      display: inline-block;
      background: ${primary};
      color: white;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      text-decoration: none;
      transition: background-color 0.2s ease;
    }

    .simula-ad-cta:hover {
      background: ${secondary};
      color: white;
      text-decoration: none;
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
        padding: 12px;
      }

      .simula-ad-title {
        font-size: 15px;
      }

      .simula-ad-description {
        font-size: 13px;
      }

      .simula-ad-cta {
        font-size: 13px;
        padding: 6px 12px;
      }
    }

    @media (max-width: 480px) {
      .simula-ad-slot {
        width: 100%;
        max-width: calc(100vw - 24px);
        margin: 8px 0;
        padding: 10px;
      }
    }
  `;
};