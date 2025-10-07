import { Message, AdData, SimulaTheme } from '../types';
import { v4 as uuidv4 } from 'uuid';

// Production API URL
// const API_BASE_URL = 'http://127.0.0.1:8000';
// const API_BASE_URL = 'https://b789dc72b1d1.ngrok-free.app'; 
const API_BASE_URL = 'https://fa0265f3e198.ngrok-free.app';

export interface FetchAdRequest {
  messages: Message[];
  formats: string[];
  apiKey: string;
  slotId?: string;
  theme?: SimulaTheme;
  sessionId?: string;
}

export interface FetchAdResponse {
  ad?: AdData;
  error?: string;
}

// Create a server session and return its id
export async function createSession(apiKey: string, devMode?: boolean): Promise<string | undefined> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    };

    const response = await fetch(`${API_BASE_URL}/session/create`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ devMode: devMode }),
    });

    if (!response.ok) {
      return undefined;
    }

    const data = await response.json();
    if (data && typeof data.sessionId === 'string' && data.sessionId) {
      return data.sessionId;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

// Validate theme parameters and throw errors for invalid ones
const validateTheme = (theme?: SimulaTheme): void => {
  if (!theme || typeof theme !== 'object') return;

  const validThemeOptions = ['light', 'dark', 'auto'];
  const validAccentOptions = ['blue', 'red', 'green', 'yellow', 'purple', 'pink', 'orange', 'neutral', 'gray', 'tan', 'transparent', 'image'];
  const validFontOptions = ['san-serif', 'serif', 'monospace'];
  const validKeys = ['theme', 'accent', 'font', 'width', 'cornerRadius'];

  // Check for invalid top-level keys
  Object.keys(theme).forEach(key => {
    if (!validKeys.includes(key)) {
      throw new Error(`Invalid theme parameter "${key}". Valid parameters: ${validKeys.join(', ')}`);
    }
  });

  // Validate theme value
  if (theme.theme !== undefined) {
    if (typeof theme.theme !== 'string') {
      throw new Error(`Invalid theme type "${typeof theme.theme}". Must be a string. Valid values: ${validThemeOptions.join(', ')}`);
    }
    if (!validThemeOptions.includes(theme.theme)) {
      throw new Error(`Invalid theme value "${theme.theme}". Valid values: ${validThemeOptions.join(', ')}`);
    }
  }

  // Validate accent value(s)
  if (theme.accent !== undefined) {
    const accents = Array.isArray(theme.accent) ? theme.accent : [theme.accent];
    accents.forEach((accent, i) => {
      if (typeof accent !== 'string') {
        throw new Error(`Invalid accent type at index ${i}: "${typeof accent}". Must be a string. Valid values: ${validAccentOptions.join(', ')}`);
      }
      if (!validAccentOptions.includes(accent)) {
        throw new Error(`Invalid accent value${Array.isArray(theme.accent) ? ` at index ${i}` : ''}: "${accent}". Valid values: ${validAccentOptions.join(', ')}`);
      }
    });
  }

  // Validate font value(s)
  if (theme.font !== undefined) {
    const fonts = Array.isArray(theme.font) ? theme.font : [theme.font];
    fonts.forEach((font, i) => {
      if (typeof font !== 'string') {
        throw new Error(`Invalid font type at index ${i}: "${typeof font}". Must be a string. Valid values: ${validFontOptions.join(', ')}`);
      }
      if (!validFontOptions.includes(font)) {
        throw new Error(`Invalid font value${Array.isArray(theme.font) ? ` at index ${i}` : ''}: "${font}". Valid values: ${validFontOptions.join(', ')}`);
      }
    });
  }

  // Note: width validation is handled in AdSlot.tsx since it needs measurement logic

  // Validate cornerRadius
  if (theme.cornerRadius !== undefined && typeof theme.cornerRadius !== 'number') {
    throw new Error(`Invalid cornerRadius type "${typeof theme.cornerRadius}". Must be a number`);
  }
};

export const fetchAd = async (request: FetchAdRequest): Promise<FetchAdResponse> => {
  try {
    // Validate theme (throws errors for invalid parameters)
    validateTheme(request.theme);

    const conversationHistory = request.messages;

    const requestBody = {
      messages: conversationHistory,
      types: request.formats,
      slot_id: request.slotId,
      theme: request.theme,
      session_id: request.sessionId,
    } as const;

    const logHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${request.apiKey?.substring(0, 10)}...`,
    };

    console.log('🚀 Sending to Simula API:', {
      url: `${API_BASE_URL}/render_ad/ssp/block`,
      method: 'POST',
      headers: logHeaders,
      body: requestBody
    });

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${request.apiKey}`,
    };

    const response = await fetch(`${API_BASE_URL}/render_ad/ssp/block`, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    console.log('📡 API Response status:', response.status, response.statusText);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    console.log('✅ API Response data:', data);

    // Handle new API shape
    if (data && typeof data === 'object') {
      // Explicit no-fill
      if (data.adInserted === false) {
        return { error: 'No fill' };
      }

      // New shape: { adType, adInserted, adResponse: { ad_id, iframe_url, ... } }
      if (data.adResponse && typeof data.adResponse === 'object') {
        const ar = data.adResponse;
        const ad: AdData = {
          id: ar.ad_id ?? ar.id,
          format: (data.adType ?? ar.format ?? 'iframe'),
          iframeUrl: ar.iframe_url ?? ar.iframeUrl,
        };

        if (ad.id && ad.iframeUrl) {
          return { ad };
        }

        return { error: 'Invalid ad response' };
      }

      // Legacy shape: { ad: { ... } }
      if (data.ad) {
        return { ad: data.ad };
      }

      if (data.error) {
        return { error: data.error };
      }
    }

    return { error: 'Unexpected response from ad server' };
  } catch (error) {
    console.error('❌ API Request failed:', error);
    return {
      error: error instanceof Error ? error.message : 'Failed to fetch ad'
    };
  }
};

export const trackImpression = async (adId: string, apiKey: string): Promise<void> => {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    };

    await fetch(`${API_BASE_URL}/track/impression/${adId}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    });
  } catch (error) {
    console.error('Failed to track impression:', error);
  }
};

/* Not used for now, used when we are also mediation layer
export const trackClick = async (adId: string, apiKey: string): Promise<void> => {
  try {
    await fetch(`${API_BASE_URL}/track_click`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        ad_id: adId,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (error) {
    console.error('Failed to track click:', error);
  }
};
*/