import React, { useEffect, useRef } from 'react';
import { useSimula } from '../SimulaProvider';
import { API_BASE_URL, reportAdInterstitial } from '../utils/api';

export type WidgetShellVariant = 'game' | 'medrec' | 'rewarded_medrec';

export interface WidgetShellProps {
  variant: WidgetShellVariant;
  /** Nested game iframe URL, required when variant === 'game'. */
  gameUrl?: string;
  /** Whether the shell should render the banner + right rails. Game variant only. */
  showBanner?: boolean;
  /** Minigame play serve_id. When provided, Aditude serves rendered inside
   *  this shell are reported back to /minigames/play/:serve_id/ad-interstitial. */
  serveId?: string | null;
  /** Fired once when the nested game posts a `GAME_COMPLETE` message (the
   *  playable signalling game-over). Used to trigger the end-of-game ad reveal
   *  without waiting for a manual close. Game variant only. */
  onGameComplete?: () => void;
  /** Override styles on the outer iframe. */
  style?: React.CSSProperties;
}

/**
 * Mounts the API-served widget shell as an iframe. The shell document owns
 * the phone case, the Aditude Cloud Wrapper, and all ad slots — the
 * publisher's page never loads Aditude directly, so `window.tude` on the
 * publisher side cannot collide with ours.
 *
 * The shell posts `{source:"simula-widget-shell", type:"adServe"}` messages
 * to `window.parent` when it successfully refreshes an Aditude slot. This
 * component listens for those messages and forwards them to the backend as
 * /ad-interstitial reports with ad_source="aditude".
 */

// Map shell divIds to the rendered_format string stored on AdServesV2.
function divIdToRenderedFormat(divId: string): string {
  if (!divId) return '';
  if (divId.includes('banner')) return 'banner';
  if (divId.includes('rail')) return 'right_rail';
  if (divId.includes('rewardedmedrec')) return 'medrec_rewarded';
  if (divId.includes('medrec')) return 'medrec';
  return divId;
}

export const WidgetShell: React.FC<WidgetShellProps> = ({
  variant,
  gameUrl,
  showBanner = true,
  serveId,
  onGameComplete,
  style,
}) => {
  const { devMode, sessionId } = useSimula();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Keep serve/session ids in refs so a single listener always sees the
  // latest values without having to re-register.
  const serveIdRef = useRef<string | null | undefined>(serveId);
  const sessionIdRef = useRef<string | undefined>(sessionId);
  useEffect(() => { serveIdRef.current = serveId; }, [serveId]);
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);

  // GAME_COMPLETE arrives at most once per play; keep the callback in a ref so
  // the single message listener stays stable, and a fired-flag so a game that
  // emits the event more than once only triggers the ad reveal a single time.
  const onGameCompleteRef = useRef<(() => void) | undefined>(onGameComplete);
  useEffect(() => { onGameCompleteRef.current = onGameComplete; }, [onGameComplete]);
  const gameCompleteFiredRef = useRef(false);

  const src = React.useMemo(() => {
    const domain = typeof window !== 'undefined' ? window.location.hostname : '';
    const parentOrigin = typeof window !== 'undefined' ? window.location.origin : '*';
    const qs = new URLSearchParams();
    qs.set('variant', variant);
    qs.set('domain', domain);
    if (gameUrl) qs.set('game_url', gameUrl);
    qs.set('show_banner', String(showBanner));
    qs.set('dev', String(!!devMode));
    qs.set('parent_origin', parentOrigin);
    return `${API_BASE_URL}/widget/shell?${qs.toString()}`;
  }, [variant, gameUrl, showBanner, devMode]);

  // Bridge: shell adServe → /ad-interstitial
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      // Accept only messages from this specific shell iframe.
      if (!iframeRef.current || e.source !== iframeRef.current.contentWindow) return;

      const data = e.data;
      if (!data || typeof data !== 'object') return;
      if (data.source !== 'simula-widget-shell') return;

      // The shell relays the nested game's own postMessages up as
      // {type:"relay", data:<game message>}. A {type:"GAME_COMPLETE"} payload
      // means the playable hit game-over — fire the end-of-game ad reveal once.
      if (data.type === 'relay') {
        const inner = data.data;
        if (
          inner && typeof inner === 'object' && inner.type === 'GAME_COMPLETE' &&
          !gameCompleteFiredRef.current
        ) {
          gameCompleteFiredRef.current = true;
          onGameCompleteRef.current?.();
        }
        return;
      }

      if (data.type !== 'adServe') return;

      const currentServeId = serveIdRef.current;
      const currentSessionId = sessionIdRef.current;
      if (!currentServeId || !currentSessionId) {
        return;
      }

      const divId: string = (data.data && data.data.divId) || '';
      // Medrec/rewarded_medrec serves are reported by the parent component's
      // close-flow (MiniGameMenu.handleIframeClose, RewardedMiniGame.loadAd)
      // to beat tab-close races. Skip them here to avoid double-counting.
      if (divId.includes('medrec')) {
        return;
      }
      const renderedFormat = divIdToRenderedFormat(divId);
      reportAdInterstitial({
        serveId: currentServeId,
        sessionId: currentSessionId,
        adSource: 'aditude',
        renderedFormat,
      });
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [variant]);

  // Game variant fills its container; medrec variants are fixed 300x250.
  const defaultStyle: React.CSSProperties =
    variant === 'game'
      ? { width: '100%', height: '100%' }
      : { width: 300, height: 250 };

  return (
    <iframe
      ref={iframeRef}
      src={src}
      title="Simula Widget"
      allow="fullscreen"
      style={{
        border: 'none',
        display: 'block',
        background: 'transparent',
        ...defaultStyle,
        ...style,
      }}
    />
  );
};
