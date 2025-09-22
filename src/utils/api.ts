import { Message, AdData, SimulaTheme } from '../types';

import { mockFetchAd, mockTrackImpression } from '../test-data/mockAds';

// Production API URL
const API_BASE_URL = 'https://simula-api-701226639755.us-central1.run.app';

export interface FetchAdRequest {
  messages: Message[];
  formats: string[];
  apiKey: string;
  slotId?: string;
  theme?: SimulaTheme;
  devMode?: boolean;
}

export interface FetchAdResponse {
  ad?: AdData;
  error?: string;
}

export const fetchAd = async (request: FetchAdRequest): Promise<FetchAdResponse> => {
  // Use mock data if in dev mode
  if (request.devMode) {
    try {
      const mockResponse = await mockFetchAd(request.theme);
      return { ad: mockResponse.ad };
    } catch (error) {
      return { error: 'Mock fetch failed' };
    }
  }

  try {
    const conversationHistory = request.messages;

    const response = await fetch(`${API_BASE_URL}/ad_fetch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${request.apiKey}`,
      },
      body: JSON.stringify({
        conversation_history: conversationHistory,
        formats: request.formats,
        slot_id: request.slotId,
        theme: request.theme,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.error) {
      return { error: data.error };
    }

    return { ad: data.ad };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Failed to fetch ad'
    };
  }
};

export const trackImpression = async (adId: string, apiKey: string, devMode?: boolean): Promise<void> => {
  // Use mock tracking if in dev mode
  if (devMode) {
    await mockTrackImpression(adId);
    return;
  }

  try {
    await fetch(`${API_BASE_URL}/track_impression`, {
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