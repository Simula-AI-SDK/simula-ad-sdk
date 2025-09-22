import { AdData, SimulaTheme } from '../types';
import { 
  getColorTheme, 
  getFontStyles, 
  getBackgroundGradient, 
  getSolidBackground,
  getTextSecondary,
  getTextMuted
} from '../utils/colorThemes';

// Function to encode HTML as data URI
const dataUriEncodeHtml = (html: string): string => {
  return 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
};

// Function to generate themed HTML for mock ads
const generateThemedHTML = (theme: SimulaTheme = {}): string => {
  const {
    theme: themeMode = 'light',
    accent = 'blue',
    font = 'san-serif',
    width = 'auto',
    mobileWidth = 350,
    minWidth = 300,
    mobileBreakpoint = 768
  } = theme;

  const colors = getColorTheme(themeMode, accent);
  const fonts = getFontStyles(font);

  return `
    <!DOCTYPE html>
    <html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        font-family: ${fonts.primary};
        background: ${getBackgroundGradient(colors)};
        color: ${colors.text}; padding: 20px; min-height: 100vh;
        display: flex; flex-direction: column; justify-content: center;
        margin: 0; box-sizing: border-box;
      }
      .headline { 
        font-size: 15px; line-height: 1.4; margin-bottom: 18px; 
        font-weight: 400; color: ${getTextSecondary(colors)};
      }
      .cta-buttons { display: flex; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }
      .cta-primary {
        background: ${colors.primary}; color: ${colors.buttonText}; border: none;
        padding: 10px 16px; border-radius: 6px; font-weight: 500; font-size: 13px;
        cursor: pointer; transition: all 0.2s ease; flex: 1; min-width: 140px;
        display: flex; align-items: center; justify-content: center; gap: 6px;
        font-family: ${fonts.primary};
      }
      .cta-primary:hover { background: ${colors.primaryHover}; }
      .cta-secondary {
        background: ${getSolidBackground(colors)}; color: ${getTextSecondary(colors)};
        border: 1px solid ${colors.border}; padding: 10px 16px;
        border-radius: 6px; font-weight: 500; font-size: 13px; cursor: pointer;
        transition: all 0.2s ease; flex: 1; min-width: 140px;
        display: flex; align-items: center; justify-content: center; gap: 6px;
        font-family: ${fonts.primary};
      }
      .cta-secondary:hover { 
        background: ${colors.secondary}20; 
        color: ${colors.text};
      }
      .footer {
        display: flex; justify-content: space-between; align-items: center;
        font-size: 11px; color: ${getTextMuted(colors)};
      }
      .brand { display: flex; align-items: center; gap: 6px; font-weight: 600; }
      .brand-icon {
        width: 16px; height: 16px; background: ${colors.primary}; border-radius: 2px;
        display: flex; align-items: center; justify-content: center; 
        font-weight: bold; font-size: 8px; color: ${colors.buttonText};
      }
      .sponsored { font-size: 11px; color: ${getTextMuted(colors)}; }
      @media (max-width: ${mobileBreakpoint}px) {
        body { padding: 16px; }
        .headline { font-size: 14px; margin-bottom: 16px; }
        .cta-buttons { gap: 8px; }
        .cta-primary, .cta-secondary { 
          padding: 8px 12px; font-size: 12px; min-width: 120px; 
        }
        .footer { font-size: 10px; }
        .brand-icon { width: 14px; height: 14px; font-size: 7px; }
      }
    </style>
    </head>
    <body>
      <div class="headline">
        Boost your writing confidence with AI-powered grammar suggestions and style improvements
      </div>
      <div class="cta-buttons">
        <button class="cta-primary" onclick="window.parent.postMessage({type: 'ad-click', url: 'https://grammarly.com'}, '*')">
          ✨ Try Free
        </button>
        <button class="cta-secondary" onclick="window.parent.postMessage({type: 'ad-click', url: 'https://grammarly.com/premium'}, '*')">
          📈 Go Premium
        </button>
      </div>
      <div class="footer">
        <div class="brand">
          <div class="brand-icon">G</div>
          <span>Grammarly</span>
        </div>
        <div class="sponsored">Sponsored</div>
      </div>
    </body></html>
  `;
};

export const mockAds: AdData[] = [
  {
    id: 'mock-ad-001',
    content: 'Enhance your writing with AI-powered suggestions',
    format: 'iframe',
    clickUrl: 'https://grammarly.com',
    impressionUrl: 'https://example.com/impression',
    iframeUrl: dataUriEncodeHtml(generateThemedHTML())
  }
];

// Helper function to get the mock ad
export const getMockAd = (): AdData => {
  return mockAds[0];
};

// Legacy export (for backward compatibility)
export const getRandomMockAd = getMockAd;

// Mock API functions for testing
export const mockFetchAd = async (request?: SimulaTheme): Promise<{ ad: AdData }> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 300));
  
  // Generate themed ad based on request
  if (request) {
    const themedHTML = generateThemedHTML(request);
    
    return {
      ad: {
        id: `themed-ad-${Date.now()}`,
        content: 'Enhance your writing with AI-powered suggestions',
        format: 'iframe',
        clickUrl: 'https://grammarly.com',
        impressionUrl: 'https://example.com/impression',
        iframeUrl: dataUriEncodeHtml(themedHTML)
      }
    };
  }
  
  // Fallback to default mock ads
  return { ad: getMockAd() };
};

export const mockTrackImpression = async (adId: string): Promise<void> => {
  console.log('Mock impression tracked:', adId);
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 100));
}; 