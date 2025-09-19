import { AdData, SimulaTheme } from '../types';
import type { FetchAdRequest } from '../utils/api';

// Function to generate themed HTML for mock ads
const generateThemedHTML = (theme: SimulaTheme = {}): string => {
  const {
    primary = '#7c3aed',
    secondary = '#4f46e5',
    border = 'rgba(255, 255, 255, 0.2)',
    width = 'auto',
    mobileWidth = 350,
    minWidth = 300,
    mobileBreakpoint = 768
  } = theme;

  const accent = '#a855f7';

  return `
    <!DOCTYPE html>
    <html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: linear-gradient(135deg, ${primary} 0%, ${secondary} 100%);
        color: #ffffff; padding: 20px; min-height: 100vh;
        display: flex; align-items: center; justify-content: center;
      }
      .ad-container {
        max-width: ${typeof width === 'number' ? width + 'px' : width === 'auto' ? '500px' : width};
        min-width: ${minWidth}px; width: 100%;
        background: rgba(255, 255, 255, 0.1);
        backdrop-filter: blur(10px); border: 1px solid ${border};
        border-radius: 12px; padding: 24px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
      }
      .headline { font-size: 16px; line-height: 1.5; margin-bottom: 20px; font-weight: 500; }
      .cta-buttons { display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
      .cta-primary {
        background: ${accent}; color: #ffffff; border: none;
        padding: 12px 20px; border-radius: 8px; font-weight: 600; font-size: 14px;
        cursor: pointer; transition: all 0.2s ease; flex: 1; min-width: 160px;
      }
      .cta-primary:hover { background: #9333ea; transform: translateY(-1px); }
      .cta-secondary {
        background: rgba(255, 255, 255, 0.1); color: #e5e7eb;
        border: 1px solid ${border}; padding: 12px 20px;
        border-radius: 8px; font-weight: 500; font-size: 14px; cursor: pointer;
        transition: all 0.2s ease; flex: 1; min-width: 160px;
      }
      .footer {
        display: flex; justify-content: space-between; align-items: center;
        font-size: 12px; color: #e5e7eb;
      }
      .brand { display: flex; align-items: center; gap: 8px; font-weight: 600; }
      .brand-icon {
        width: 20px; height: 20px; background: ${accent}; border-radius: 4px;
        display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 10px;
      }
      @media (max-width: ${mobileBreakpoint}px) {
        .ad-container { 
          max-width: ${mobileWidth}px; padding: 20px; 
        }
        .cta-buttons { flex-direction: column; }
        .cta-primary, .cta-secondary { width: 100%; min-width: auto; }
        .headline { font-size: 15px; }
      }
    </style></head>
    <body>
      <div class="ad-container">
        <div class="headline">Speaking of polished communication, would you like to make your future emails even more impactful?</div>
        <div class="cta-buttons">
          <button class="cta-primary" onclick="handleClick('primary')">✨ Enhance My Writing</button>
          <button class="cta-secondary" onclick="handleClick('secondary')">📧 See Email Templates</button>
        </div>
        <div class="footer">
          <div class="brand"><div class="brand-icon">G</div><span>GRAMMARLY</span></div>
          <div>Sponsored Content</div>
        </div>
      </div>
      <script>
        function handleClick(type) {
          console.log('Mock ad clicked:', type);
          if (window.parent && window.parent.postMessage) {
            window.parent.postMessage({ type: 'ad-click', data: { buttonType: type } }, '*');
          }
          window.open(type === 'primary' ? 'https://grammarly.com' : 'https://grammarly.com/templates', '_blank');
        }
        window.addEventListener('load', () => {
          if (window.parent && window.parent.postMessage) {
            window.parent.postMessage({ type: 'ad-loaded', data: { adId: 'mock-ad' } }, '*');
          }
        });
      </script>
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
    iframeUrl: 'data:text/html;base64,' + btoa(generateThemedHTML())
  }
];

// Helper function to get the mock ad
export const getMockAd = (): AdData => {
  return mockAds[0];
};

// Legacy export (for backward compatibility)
export const getRandomMockAd = getMockAd;

// Mock API functions for testing
export const mockFetchAd = async (request?: FetchAdRequest): Promise<{ ad: AdData }> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 300));
  
  // Generate themed ad based on request
  if (request?.theme) {
    const themedHTML = generateThemedHTML(request.theme);
    
    return {
      ad: {
        id: `themed-ad-${Date.now()}`,
        content: 'Enhance your writing with AI-powered suggestions',
        format: 'iframe',
        clickUrl: 'https://grammarly.com',
        impressionUrl: 'https://example.com/impression',
        iframeUrl: 'data:text/html;base64,' + btoa(themedHTML)
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