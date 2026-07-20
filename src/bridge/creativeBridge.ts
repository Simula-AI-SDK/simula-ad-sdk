import { connectionTypeValue } from '../core/connectionType';

/**
 * Creative bridge — web port of the native `CreativeBridge`. Routes
 * `window.postMessage` envelopes `{ type, requestId?, payload? }` from an ad
 * creative's iframe to the SDK, and replies with
 * `{ type, requestId, payload, __simulaSdkResponse: true }` posted back to the
 * creative (the `__simulaSdkResponse` marker lets the creative drop its own
 * outbound echoes).
 *
 * Inbound contract (native parity + the documented web CTA extension):
 * - `AD_EARLY_COMPLETE`   → the creative asks to be closed early
 * - `CTA_CLICK`           → creative CTA tap (payload: `{ url? }`) — web's
 *                           click-through channel, since cross-origin iframe
 *                           taps are not visible to the parent page
 * - `CREATIVE_MOMENT`     → lifecycle moment (payload: `{ moment }`), matched
 *                           verbatim against auto_store_redirect triggers
 * - `GET_DEVICE_CONTEXT`  → replies with device context
 * - `GET_AUDIO_STATE`     → replies with audio state (unknowns on web)
 * - `GET_ORIENTATION`     → replies with 'portrait' | 'landscape'
 */

export interface CreativeBridgeHandlers {
  onEarlyComplete?: () => void;
  onCtaClick?: (url?: string) => void;
  onCreativeMoment?: (moment: string) => void;
}

function deviceContextPayload(): Record<string, unknown> {
  try {
    return {
      platform: 'web',
      language: typeof navigator !== 'undefined' ? navigator.language : undefined,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      connectionType: connectionTypeValue(),
      screen: typeof window !== 'undefined' ? { width: window.screen.width, height: window.screen.height } : undefined,
      viewport:
        typeof window !== 'undefined' ? { width: window.innerWidth, height: window.innerHeight } : undefined,
    };
  } catch {
    return { platform: 'web' };
  }
}

function audioStatePayload(): Record<string, unknown> {
  // Browsers expose no system volume/ringer APIs — explicit unknowns
  return { muted: null, volume: null };
}

function orientationPayload(): Record<string, unknown> {
  let orientation: 'portrait' | 'landscape' = 'portrait';
  try {
    if (typeof window !== 'undefined') {
      orientation = window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
    }
  } catch {
    // default portrait
  }
  return { orientation };
}

function reply(iframe: HTMLIFrameElement, type: string, requestId: unknown, payload: Record<string, unknown>): void {
  try {
    const message: Record<string, unknown> = { type, payload, __simulaSdkResponse: true };
    if (requestId !== undefined && requestId !== null) message.requestId = requestId;
    iframe.contentWindow?.postMessage(message, '*');
  } catch {
    // Best-effort reply
  }
}

/**
 * Attach a bridge listener scoped to one creative iframe. Returns a detach
 * function. Messages from any other source are ignored. Never throws.
 */
export function attachCreativeBridge(iframe: HTMLIFrameElement, handlers: CreativeBridgeHandlers): () => void {
  const onMessage = (event: MessageEvent) => {
    try {
      if (event.source !== iframe.contentWindow) return;
      const data: any = event.data;
      if (!data || typeof data !== 'object' || typeof data.type !== 'string') return;
      if (data.__simulaSdkResponse === true) return; // our own reply echo

      const type = data.type as string;
      const requestId = data.requestId;
      const payload = data.payload && typeof data.payload === 'object' ? data.payload : undefined;

      switch (type) {
        case 'AD_EARLY_COMPLETE':
          handlers.onEarlyComplete?.();
          break;
        case 'CTA_CLICK':
          handlers.onCtaClick?.(typeof payload?.url === 'string' ? payload.url : undefined);
          break;
        case 'CREATIVE_MOMENT':
          if (typeof payload?.moment === 'string') handlers.onCreativeMoment?.(payload.moment);
          break;
        case 'GET_DEVICE_CONTEXT':
          reply(iframe, type, requestId, deviceContextPayload());
          break;
        case 'GET_AUDIO_STATE':
          reply(iframe, type, requestId, audioStatePayload());
          break;
        case 'GET_ORIENTATION':
          reply(iframe, type, requestId, orientationPayload());
          break;
        default:
          break;
      }
    } catch {
      // A malformed creative message must never break the host page
    }
  };

  try {
    window.addEventListener('message', onMessage);
  } catch {
    // No window (SSR) — inert bridge
  }

  return () => {
    try {
      window.removeEventListener('message', onMessage);
    } catch {
      // ignore
    }
  };
}

/** The bridge message type a creative uses for CTA taps (web extension, documented). */
export const BRIDGE_CTA_CLICK = 'CTA_CLICK';

/** The bridge message type a creative uses to report its content height (web extension). */
export const BRIDGE_AD_SIZE = 'SIMULA_AD_SIZE';
