import { Message, AdData, InChatTheme, GameData, NativeContext, FetchAdRequest, FetchAdResponse, CatalogResponse, InitMinigameRequest, MinigameResponse, AditudeConfig, FetchNativeBannerRequest, FetchNativeAdResponse, InitRewardedResponse, VerifyRewardResponse } from '../types';

// export const API_BASE_URL = 'https://simula-api-701226639755.us-central1.run.app';
// export const API_BASE_URL = 'https://splittable-unpatient-maxine.ngrok-free.dev';
export const API_BASE_URL = 'https://simula-dev-ad.ngrok.app'


// Create a server session and return its id
export async function createSession(apiKey: string, devMode?: boolean, primaryUserID?: string): Promise<string | undefined> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'ngrok-skip-browser-warning': '1',
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

// Update the primaryUserID (PPID) on an existing session
export async function updateSessionPpid(sessionId: string, ppid: string): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/session/${sessionId}/ppid/${ppid}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '1',
      },
    });
  } catch {
    // Best-effort PPID update — failure is non-fatal
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
      'ngrok-skip-browser-warning': '1',
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
      'ngrok-skip-browser-warning': '1',
    };

    await fetch(`${API_BASE_URL}/track/engagement/impression/${adId}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    });
  } catch {
    // Best-effort tracking
  }
};

export const trackMenuGameClick = async (menuId: string, gameName: string, apiKey: string): Promise<void> => {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'ngrok-skip-browser-warning': '1',
    };

    await fetch(`${API_BASE_URL}/minigames/menu/track/click`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        menu_id: menuId,
        game_name: gameName,
      }),
    });
  } catch {
    // Best-effort tracking
  }
};

export const trackViewportEntry = async (adId: string, apiKey: string): Promise<void> => {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'ngrok-skip-browser-warning': '1',
    };

    await fetch(`${API_BASE_URL}/track/engagement/viewport_entry/${adId}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
      }),
    });
  } catch {
    // Best-effort tracking
  }
};

export const trackViewportExit = async (adId: string, apiKey: string): Promise<void> => {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'ngrok-skip-browser-warning': '1',
    };

    await fetch(`${API_BASE_URL}/track/engagement/viewport_exit/${adId}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
      }),
    });
  } catch {
    // Best-effort tracking
  }
};

export const fetchCatalog = async (): Promise<CatalogResponse> => {
    const response: Response = await fetch(`${API_BASE_URL}/minigames/catalogv2`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': '1',
        },
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const responseData = await response.json();

    // Extract menu_id from response
    const menuId = responseData.menu_id ?? '';

    // Handle different response formats: catalog.data or direct data array
    let gamesList: any[];
    if (responseData.catalog != null) {
        const catalog = responseData.catalog;
        if (Array.isArray(catalog)) {
            gamesList = catalog;
        } else if (catalog && catalog.data != null) {
            gamesList = catalog.data as any[];
        } else {
            gamesList = responseData.data ?? [];
        }
    } else {
        gamesList = responseData.data ?? [];
    }

    // Map API response to GameData format (icon -> iconUrl)
    const games: GameData[] = gamesList.map((game: any) => ({
        id: game.id,
        name: game.name,
        iconUrl: game.icon,
        description: game.description ?? '',
        iconFallback: game.iconFallback,
        gifCover: game.gif_cover,
    }));

    return { menuId, games };
}

export const getMinigame = async (params: InitMinigameRequest): Promise<MinigameResponse> => {
    const requestBody: Record<string, any> = {
        game_type: params.gameType,
        session_id: params.sessionId,
        conv_id: params.convId ?? null,
        entry_point: params.entryPoint ?? null,
        currency_mode: params.currencyMode ?? false,
        w: params.w,
        h: params.h,
        char_id: params.char_id,
        char_name: params.char_name,
        char_image: params.char_image,
        char_desc: params.char_desc,
        messages: params.messages,
        delegate_char: params.delegate_char ?? true,
    };

    if (params.menuId) {
        requestBody.menu_id = params.menuId;
    }

    const response: Response = await fetch(`${API_BASE_URL}/minigames/init`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': '1',
        },
        body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
}

export const fetchAdForMinigame = async (aid: string, sessionId: string): Promise<string | null> => {
    try {
        const response: Response = await fetch(`${API_BASE_URL}/minigames/fallback_ad/${aid}?session_id=${encodeURIComponent(sessionId)}`, {
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
    } catch {
        return null;
    }
};

// Rewarded MiniGame API
export const initRewardedGame = async (params: {
  sessionId: string;
  w: number;
  h: number;
  charId?: string;
  charName?: string;
  charImage?: string;
  charDesc?: string;
  messages?: Message[];
  minPlayThreshold?: number;
}): Promise<InitRewardedResponse> => {
  const requestBody: Record<string, any> = {
    session_id: params.sessionId,
    w: params.w,
    h: params.h,
    char_id: params.charId,
    char_name: params.charName,
    char_image: params.charImage,
    char_desc: params.charDesc,
    messages: params.messages,
  };

  if (params.minPlayThreshold !== undefined) {
    requestBody.min_play_threshold = params.minPlayThreshold;
  }

  const response: Response = await fetch(`${API_BASE_URL}/minigames/init/rewarded`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': '1',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.json();
};

export const verifyReward = async (params: {
  serveId: string;
  sessionId: string;
  elapsedPlayTime: number;
}): Promise<VerifyRewardResponse> => {
  const response: Response = await fetch(`${API_BASE_URL}/minigames/verify-reward`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': '1',
    },
    body: JSON.stringify({
      serve_id: params.serveId,
      session_id: params.sessionId,
      elapsed_play_time: params.elapsedPlayTime,
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.json();
};

export const reportAdInterstitial = async (params: {
  serveId: string;
  sessionId: string;
  adSource: 'simula' | 'aditude' | 'none';
  renderedFormat?: string;
}): Promise<void> => {
  try {
    // keepalive: true — the close-flow variant of this call fires
    // immediately before the user navigates away. Without keepalive the
    // browser aborts the beacon on tab close / navigation, losing the
    // impression.
    await fetch(`${API_BASE_URL}/minigames/play/${encodeURIComponent(params.serveId)}/ad-interstitial`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '1',
      },
      body: JSON.stringify({
        session_id: params.sessionId,
        ad_source: params.adSource,
        rendered_format: params.renderedFormat ?? null,
      }),
      keepalive: true,
    });
  } catch {
    // Best-effort tracking — don't block the ad flow
  }
};

// Aditude API
export const fetchAditudeConfig = async (domain: string): Promise<AditudeConfig | null> => {
  try {
    const response = await fetch(`${API_BASE_URL}/aditude/config?domain=${encodeURIComponent(domain)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '1',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: AditudeConfig = await response.json();
    return data;
  } catch {
    return null;
  }
};

export const fetchAllAditudeConfigs = async (): Promise<AditudeConfig[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/aditude/config/all`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '1',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: AditudeConfig[] = await response.json();
    return data;
  } catch {
    return [];
  }
};

// NativeBanner API
export const fetchNativeBannerAd = async (request: FetchNativeBannerRequest): Promise<FetchNativeAdResponse> => {
  try {
    const requestBody = {
      session_id: request.sessionId,
      slot: request.slot,
      position: request.position,
      context: request.context,
      width: request.width,
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': '1',
    };

    const response = await fetch(`${API_BASE_URL}/render_ad/ssp/native`, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Check if response is HTML
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      const html = await response.text();
      // Extract ad_id from response headers (FastAPI sends it as "aid" header)
      const adId = response.headers.get('aid');
      return {
        ad: {
          id: adId ?? '',
          format: "native",
          html: html
        }
      };
    }
    // Fallback
    return {
        ad: {
          id: '',
          format: '',
          html: ''
        }
      };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Failed to fetch native banner ad'
    };
  }
};