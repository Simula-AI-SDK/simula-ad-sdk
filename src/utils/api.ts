import { Message, AdData } from '../types';

const API_BASE_URL = 'https://simula-api-701226639755.us-central1.run.app';

export interface FetchAdRequest {
  messages: Message[];
  formats: string[];
  apiKey: string;
  slotId?: string;
}

export interface FetchAdResponse {
  ad?: AdData;
  error?: string;
}

export const fetchAd = async (request: FetchAdRequest): Promise<FetchAdResponse> => {
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

export const trackImpression = async (adId: string, apiKey: string): Promise<void> => {
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