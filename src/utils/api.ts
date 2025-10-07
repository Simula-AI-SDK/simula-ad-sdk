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

// Get or create a stable anonymous user id stored in localStorage
function getOrCreateSimulaUserId(): string | undefined {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return undefined;

    const STORAGE_KEY = 'simula_user_id';
    let existing = window.localStorage.getItem(STORAGE_KEY);
    if (existing && existing.length > 0) return existing;

    const newId = uuidv4();
    window.localStorage.setItem(STORAGE_KEY, newId);
    return newId;
  } catch {
    // Storage may be unavailable (privacy mode/SSR). Return undefined gracefully.
    return undefined;
  }
}

export const fetchAd = async (request: FetchAdRequest): Promise<FetchAdResponse> => {
  try {
    const conversationHistory = request.messages;
    const userId = getOrCreateSimulaUserId();
    
    const requestBody = {
      messages: conversationHistory,
      types: request.formats,
      slot_id: request.slotId,
      theme: request.theme,
      // user_id: userId,
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