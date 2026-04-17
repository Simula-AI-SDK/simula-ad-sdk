import React from 'react';
import { useSimula } from '../SimulaProvider';

// Mirror the API_BASE_URL from utils/api.ts. The widget shell route is part
// of the same backend so it uses the same base.
const API_BASE_URL = 'https://simula-api-701226639755.us-central1.run.app';

export type WidgetShellVariant = 'game' | 'medrec' | 'rewarded_medrec';

export interface WidgetShellProps {
  variant: WidgetShellVariant;
  /** Nested game iframe URL, required when variant === 'game'. */
  gameUrl?: string;
  /** Whether the shell should render the banner + right rails. Game variant only. */
  showBanner?: boolean;
  /** Override styles on the outer iframe. */
  style?: React.CSSProperties;
}

/**
 * Mounts the API-served widget shell as an iframe. The shell document owns
 * the phone case, the Aditude Cloud Wrapper, and all ad slots — the
 * publisher's page never loads Aditude directly, so `window.tude` on the
 * publisher side cannot collide with ours.
 */
export const WidgetShell: React.FC<WidgetShellProps> = ({
  variant,
  gameUrl,
  showBanner = true,
  style,
}) => {
  const { devMode } = useSimula();

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

  // Game variant fills its container; medrec variants are fixed 300x250.
  const defaultStyle: React.CSSProperties =
    variant === 'game'
      ? { width: '100%', height: '100%' }
      : { width: 300, height: 250 };

  return (
    <iframe
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
