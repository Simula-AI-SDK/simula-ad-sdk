import { Message, AdData, InChatTheme, GameData } from '../types';

// Production API URL
// const API_BASE_URL = 'https://simula-api-701226639755.us-central1.run.app';
// const API_BASE_URL = "https://lace-compressed-symphony-scout.trycloudflare.com"
const API_BASE_URL = "https://710e52738b44.ngrok-free.app"

export interface FetchAdRequest {
  messages: Message[];
  apiKey: string;
  slotId?: string;
  theme?: InChatTheme;
  sessionId?: string;
  charDesc?: string;
}

export interface FetchAdResponse {
  ad?: AdData;
  error?: string;
}

// Create a server session and return its id
export async function createSession(apiKey: string, devMode?: boolean, primaryUserID?: string): Promise<string | undefined> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    };

    // Build query parameters
    const params = new URLSearchParams();
    if (devMode !== undefined) {
      params.append('devMode', String(devMode));
    }
    if (primaryUserID !== undefined && primaryUserID !== '') {
      params.append('ppid', primaryUserID);
    }

    const queryString = params.toString();
    const url = `${API_BASE_URL}/session/create${queryString ? `?${queryString}` : ''}`;

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Invalid API key (please check dashboard or contact Simula team for a valid API key)');
      }
      return undefined;
    }

    const data = await response.json();
    if (data && typeof data.sessionId === 'string' && data.sessionId) {
      return data.sessionId;
    }
    return undefined;
  } catch (error) {
    // Re-throw 401 errors with our custom message
    if (error instanceof Error && error.message.includes('Invalid API key')) {
      throw error;
    }
    return undefined;
  }
}

export const fetchAd = async (request: FetchAdRequest): Promise<FetchAdResponse> => {
  try {
    const conversationHistory = request.messages;

    // Normalize theme accent and font to arrays for backend
    // Also handle backward compatibility: prefer 'mode' over 'theme', but support both
    const normalizedTheme = request.theme ? (() => {
      const { theme: themeDeprecated, ...themeRest } = request.theme as any;
      return {
        ...themeRest,
        mode: request.theme.mode ?? themeDeprecated, // Prefer 'mode', fallback to 'theme' for backward compatibility
        accent: request.theme.accent ? (Array.isArray(request.theme.accent) ? request.theme.accent : [request.theme.accent]) : undefined,
        font: request.theme.font ? (Array.isArray(request.theme.font) ? request.theme.font : [request.theme.font]) : undefined,
      };
    })() : undefined;

    const requestBody = {
      messages: conversationHistory,
      slot_id: request.slotId,
      theme: normalizedTheme,
      session_id: request.sessionId,
      char_desc: request.charDesc,
    } as const;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${request.apiKey}`,
    };

    const response = await fetch(`${API_BASE_URL}/render_ad/ssp`, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // Handle new API shape
    if (data && typeof data === 'object') {
      if (!data.adInserted) {
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

    await fetch(`${API_BASE_URL}/track/engagement/impression/${adId}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    });
  } catch (error) {
    console.error('Failed to track impression:', error);
  }
};

export const fetchCatalog = async (): Promise<GameData[]> => {
    try {
        const response: Response = await fetch(`${API_BASE_URL}/minigames/catalog`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const responseData: { data: any[] } = await response.json();
        
        // Map API response to GameData format (icon -> iconUrl)
        const games: GameData[] = responseData.data.map((game: any) => ({
            id: game.id,
            name: game.name,
            iconUrl: game.icon, // API returns 'icon', we use 'iconUrl'
            description: game.description,
            iconFallback: game.iconFallback,
        }));
        
        return games;
    } catch (error) {
        console.error('Failed to fetch catalog:', error);
        throw error;
    }
}

export interface InitMinigameRequest {
    gameType: string;
    sessionId: string;
    convId?: string | null;
    currencyMode?: boolean;
    w: number;
    h: number;
    char_id?: string;
    char_name?: string;
    char_image?: string;
    char_desc?: string;
    messages?: Message[];
    delegate_char?: boolean;
}

export interface MinigameResponse {
    adType: 'minigame';
    adInserted: boolean;
    adResponse: {
        ad_id: string;
        iframe_url: string;
    };
}

export const getMinigame = async (params: InitMinigameRequest): Promise<MinigameResponse> => {
    try {
        const response: Response = await fetch(`${API_BASE_URL}/minigames/init`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                game_type: params.gameType,
                session_id: params.sessionId,
                conv_id: params.convId ?? null,
                currency_mode: params.currencyMode ?? false,
                w: params.w,
                h: params.h,
                char_id: params.char_id,
                char_name: params.char_name,
                char_image: params.char_image,
                char_desc: params.char_desc,
                messages: params.messages,
                delegate_char: params.delegate_char ?? true,
            }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data: MinigameResponse = await response.json();
        return data;
    } catch (error) {
        console.error('Failed to initialize minigame:', error);
        throw error;
    }
}

export const fetchAdForMinigame = async (aid: string): Promise<string | null> => {
    try {
        const response: Response = await fetch(`${API_BASE_URL}/minigames/fallback_ad/${aid}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data: MinigameResponse = await response.json();
        
        if (data.adResponse && data.adResponse.iframe_url) {
            return data.adResponse.iframe_url;
        }

        return null;
    } catch (error) {
        console.error('Failed to fetch ad for minigame:', error);
        return null;
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