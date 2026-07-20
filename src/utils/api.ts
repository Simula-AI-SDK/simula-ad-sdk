import { Message, AdData, InChatTheme, GameData, NativeContext, FetchAdRequest, FetchAdResponse, CatalogResponse, InitMinigameRequest, MinigameResponse, AditudeConfig, FetchNativeBannerRequest, FetchNativeAdResponse, InitRewardedResponse, VerifyRewardResponse } from '../types';
import { SDK_HEADER_VALUE } from '../core/version';
import { logger } from './logger';
import { SimulaPrivacy, consentHeaders, privacyJson } from '../privacy/SimulaPrivacy';
import { deviceSignalHeaders } from '../core/deviceSignals';
import { connectionTypeValue } from '../core/connectionType';
import { BeaconQueue } from '../core/beaconQueue';

export const API_BASE_URL = 'https://simula-api-701226639755.us-central1.run.app';
// export const API_BASE_URL = 'https://splittable-unpatient-maxine.ngrok-free.dev';
// export const API_BASE_URL = 'https://simula-dev-ad.ngrok.app'

/**
 * Central request-headers builder — the SDK's single header chokepoint
 * (native parity: SimulaApiClient.makeHeaders). Every backend request carries:
 * - `X-Simula-SDK` — SDK identity (web equivalent of the native custom User-Agent)
 * - `X-Connection-Type` — live OpenRTB connection type
 * - device-signal headers — TTL-cached snapshot, zero per-request cost
 * - consent headers — read LIVE from SimulaPrivacy at request time, never cached
 */
function buildHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-Simula-SDK': SDK_HEADER_VALUE,
    'X-Connection-Type': String(connectionTypeValue()),
    ...deviceSignalHeaders(),
    ...consentHeaders(SimulaPrivacy.current),
    ...extra,
  };
}

/** Server telemetry directive embedded in the /session/create response. */
export interface SessionTelemetryDirective {
  telemetryEnabled?: boolean;
  telemetrySampleRate?: number;
}

export interface CreateSessionResult {
  sessionId?: string;
  directive: SessionTelemetryDirective;
}

// Create a server session and return its id + server directives. Never throws —
// an invalid API key is logged loudly for the publisher and resolves to no
// session instead of an uncaught rejection in the host page.
export async function createSession(apiKey: string, devMode?: boolean, primaryUserID?: string): Promise<CreateSessionResult> {
  try {
    const headers = buildHeaders({ 'Authorization': `Bearer ${apiKey}` });

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
      // Consent signals block (native parity: ConsentSnapshot.privacyJson)
      body: JSON.stringify({ privacy: privacyJson(SimulaPrivacy.current) }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        logger.error('Invalid API key (please check dashboard or contact Simula team for a valid API key)');
      }
      return { directive: {} };
    }

    const data = await response.json();
    const directive: SessionTelemetryDirective = {
      telemetryEnabled: typeof data?.telemetry_enabled === 'boolean' ? data.telemetry_enabled : undefined,
      telemetrySampleRate: typeof data?.telemetry_sample_rate === 'number' ? data.telemetry_sample_rate : undefined,
    };
    if (data && typeof data.sessionId === 'string' && data.sessionId) {
      return { sessionId: data.sessionId, directive };
    }
    return { directive };
  } catch {
    return { directive: {} };
  }
}

// Update the primaryUserID (PPID) on an existing session
export async function updateSessionPpid(sessionId: string, ppid: string): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/session/${sessionId}/ppid/${ppid}`, {
      method: 'PATCH',
      headers: buildHeaders(),
    });
  } catch {
    // Best-effort PPID update — failure is non-fatal
  }
}

// In-flight dedup for idempotent reads (native parity: SimulaApiClient.coalesce)
const inFlightReads = new Map<string, Promise<boolean>>();

/**
 * `GET /frequency-cap/status` — read-only check, records no impression.
 * Wire contract (native parity): `?ad_unit_id=…[&ppid=…][&session_id=…]`,
 * response `{"capped": true|false}`. Fails open: non-2xx, unparseable body,
 * or network failure resolves to `false`.
 */
export function checkFrequencyCapStatus(
  apiKey: string,
  adUnitId: string,
  ppid?: string,
  sessionId?: string,
): Promise<boolean> {
  let url = `${API_BASE_URL}/frequency-cap/status?ad_unit_id=${encodeURIComponent(adUnitId)}`;
  if (ppid) url += `&ppid=${encodeURIComponent(ppid)}`;
  if (sessionId) url += `&session_id=${encodeURIComponent(sessionId)}`;

  const inFlight = inFlightReads.get(url);
  if (inFlight) return inFlight;

  const promise = (async () => {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: buildHeaders({ 'Authorization': `Bearer ${apiKey}` }),
      });
      if (!response.ok) return false;
      const data = await response.json();
      return data && data.capped === true;
    } catch {
      return false;
    } finally {
      inFlightReads.delete(url);
    }
  })();
  inFlightReads.set(url, promise);
  return promise;
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

    const headers = buildHeaders({ 'Authorization': `Bearer ${request.apiKey}` });

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
  // Durable: enqueued for guaranteed delivery (survives offline / tab close)
  BeaconQueue.enqueue({
    url: `${API_BASE_URL}/track/engagement/impression/${adId}`,
    method: 'POST',
    headers: buildHeaders({ 'Authorization': `Bearer ${apiKey}` }),
    body: JSON.stringify({}),
  });
};

export const trackMenuGameClick = async (menuId: string, gameName: string, apiKey: string): Promise<void> => {
  BeaconQueue.enqueue({
    url: `${API_BASE_URL}/minigames/menu/track/click`,
    method: 'POST',
    headers: buildHeaders({ 'Authorization': `Bearer ${apiKey}` }),
    body: JSON.stringify({
      menu_id: menuId,
      game_name: gameName,
    }),
  });
};

export const trackViewportEntry = async (adId: string, apiKey: string): Promise<void> => {
  BeaconQueue.enqueue({
    url: `${API_BASE_URL}/track/engagement/viewport_entry/${adId}`,
    method: 'POST',
    headers: buildHeaders({ 'Authorization': `Bearer ${apiKey}` }),
    body: JSON.stringify({
      timestamp: new Date().toISOString(),
    }),
  });
};

export const trackViewportExit = async (adId: string, apiKey: string): Promise<void> => {
  BeaconQueue.enqueue({
    url: `${API_BASE_URL}/track/engagement/viewport_exit/${adId}`,
    method: 'POST',
    headers: buildHeaders({ 'Authorization': `Bearer ${apiKey}` }),
    body: JSON.stringify({
      timestamp: new Date().toISOString(),
    }),
  });
};

export const fetchCatalog = async (): Promise<CatalogResponse> => {
    const response: Response = await fetch(`${API_BASE_URL}/minigames/catalogv2`, {
        method: 'GET',
        headers: buildHeaders(),
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
        headers: buildHeaders(),
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
    headers: buildHeaders(),
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
    headers: buildHeaders(),
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
      headers: buildHeaders(),
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
      headers: buildHeaders(),
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

    const headers = buildHeaders();

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