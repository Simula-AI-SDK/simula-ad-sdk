import { AdData, SimulaTheme } from '../types';
import type { FetchAdRequest } from '../utils/api';

// Build a UTF-8 safe data URI for HTML without using btoa
const dataUriEncodeHtml = (html: string): string => {
  return 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
};

// Function to generate themed HTML for mock ads
const generateThemedHTML = (theme: SimulaTheme = {}): string => {
  const {
    primary = '#7c3aed',
    secondary = '#4f46e5',
    border = 'rgba(255, 255, 255, 0.2)',
    background = '#1a1b2e',
    width = 'auto',
    mobileWidth = 350,
    minWidth = 300,
    mobileBreakpoint = 768
  } = theme;

  const accent = primary;

  return `
    <!DOCTYPE html>
    <html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: ${background};
        color: #ffffff; padding: 20px; min-height: 100vh;
        display: flex; flex-direction: column; justify-content: center;
        margin: 0; box-sizing: border-box;
      }
      .headline { 
        font-size: 15px; line-height: 1.4; margin-bottom: 18px; 
        font-weight: 400; color: #e2e8f0;
      }
      .cta-buttons { display: flex; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }
      .cta-primary {
        background: ${primary}; color: #ffffff; border: none;
        padding: 10px 16px; border-radius: 6px; font-weight: 500; font-size: 13px;
        cursor: pointer; transition: all 0.2s ease; flex: 1; min-width: 140px;
        display: flex; align-items: center; justify-content: center; gap: 6px;
      }
              .cta-primary:hover { background: ${secondary}; }
      .cta-secondary {
        background: rgba(255, 255, 255, 0.1); color: #e5e7eb;
        border: 1px solid ${border}; padding: 10px 16px;
        border-radius: 6px; font-weight: 500; font-size: 13px; cursor: pointer;
        transition: all 0.2s ease; flex: 1; min-width: 140px;
        display: flex; align-items: center; justify-content: center; gap: 6px;
      }
      .cta-secondary:hover { background: rgba(255, 255, 255, 0.15); }
      .footer {
        display: flex; justify-content: space-between; align-items: center;
        font-size: 11px; color: #9ca3af;
      }
      .brand { display: flex; align-items: center; gap: 6px; font-weight: 600; }
      .brand-icon {
        width: 16px; height: 16px; background: #10b981; border-radius: 2px;
        display: flex; align-items: center; justify-content: center; 
        font-weight: bold; font-size: 8px; color: white;
      }
      .sponsored { font-size: 11px; color: #6b7280; }
      @media (max-width: ${mobileBreakpoint}px) {
        body { 
          padding: 16px; 
        }
        .cta-buttons { flex-direction: column; }
        .cta-primary, .cta-secondary { width: 100%; min-width: auto; }
        .headline { font-size: 14px; }
      }
    </style></head>
    <body>
      <div class="headline">Speaking of polished communication, would you like to make your future emails even more impactful?</div>
      <div class="cta-buttons">
        <button class="cta-primary" onclick="handleClick('primary')">✨ Enhance My Writing</button>
        <button class="cta-secondary" onclick="handleClick('secondary')">📧 See Email Templates</button>
      </div>
      <div class="footer">
        <div class="brand"><div class="brand-icon">G</div><span>GRAMMARLY</span></div>
        <div class="sponsored">Sponsored Content</div>
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