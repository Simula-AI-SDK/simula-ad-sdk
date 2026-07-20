import { CloseBehavior, AdUnitType, defaultCloseBehavior } from './adBehavior';
import { LoadedCreative } from '../utils/api';
import { attachCreativeBridge, BRIDGE_CTA_CLICK } from '../bridge/creativeBridge';

/**
 * Fullscreen ad presenter — renders a loaded creative in a fixed overlay
 * above the host page (web counterpart of the native interstitial/rewarded
 * Activities/UIWindows).
 *
 * Close chrome is fully server-driven via the resolved `CloseBehavior`
 * (native parity):
 * - the close affordance is GATED for `delaySeconds` (clamped [0, 45])
 * - during the gate the treatment renders: `countdown_circle` (SVG ring),
 *   `progress_bar` (top bar tinted progressBarColor), `reward_or_close_label`
 *   (countdown pill), or nothing (`hidden`)
 * - after the gate a 32px ✕ appears at `position` (top_right/top_left/bottom_left)
 * - ESC is blocked while the gate is active
 *
 * Signals: `onDisplayed` at mount (shown), `onImpression` ~2s after the
 * creative finishes rendering (billable), `onCtaClick` on a creative CTA tap
 * (bridge `CTA_CLICK`), `onClose` exactly once.
 */

export interface FullscreenPresenterHandlers {
  onDisplayed: () => void;
  onImpression: () => void;
  onCtaClick: (url?: string) => void;
  onClose: (elapsedSeconds: number) => void;
  onRewardGateElapsed?: () => void;
  onCreativeMoment?: (moment: string) => void;
}

export interface FullscreenPresenterHandle {
  close: () => void;
}

const Z_INDEX = 2147483647;
const IMPRESSION_DELAY_MS = 2_000;

export function presentFullscreenAd(opts: {
  creative: LoadedCreative;
  adUnitType: AdUnitType;
  closeBehavior?: CloseBehavior;
  handlers: FullscreenPresenterHandlers;
}): FullscreenPresenterHandle | null {
  if (typeof document === 'undefined' || !document.body) return null;

  const behavior = opts.closeBehavior ?? opts.creative.adBehavior?.close ?? defaultCloseBehavior();
  const delaySeconds = behavior.delaySeconds;
  const mountedAt = Date.now();

  // One fullscreen ad at a time: a stale overlay from a previous mount (e.g.
  // the host tore down without closing) is removed before presenting, so its
  // scroll lock can never leak.
  try {
    document.querySelectorAll('[data-simula-fullscreen-ad]').forEach((el) => el.remove());
    document.documentElement.style.overflow = '';
  } catch {
    // Best-effort cleanup
  }

  let closed = false;
  let impressionTimer: ReturnType<typeof setTimeout> | null = null;
  let gateInterval: ReturnType<typeof setInterval> | null = null;
  let detachBridge: (() => void) | null = null;
  let gateFired = false;

  // ── DOM ──────────────────────────────────────────────────────────────────
  const overlay = document.createElement('div');
  overlay.setAttribute('data-simula-fullscreen-ad', 'true');
  overlay.style.cssText = [
    'position:fixed',
    'inset:0',
    `z-index:${Z_INDEX}`,
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'background:rgba(0,0,0,0.92)',
  ].join(';');

  const frameWrap = document.createElement('div');
  frameWrap.style.cssText = 'position:relative;width:100%;height:100%;';

  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'display:block;width:100%;height:100%;border:0;margin:0;padding:0;background:#000;';
  iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox');
  iframe.setAttribute('allow', 'autoplay; encrypted-media');
  iframe.title = 'Simula advertisement';

  frameWrap.appendChild(iframe);
  overlay.appendChild(frameWrap);

  // ── Close chrome ─────────────────────────────────────────────────────────
  const chromeWrap = document.createElement('div');
  chromeWrap.style.cssText = 'position:absolute;inset:0;pointer-events:none;';
  frameWrap.appendChild(chromeWrap);

  const positionStyle = (pos: CloseBehavior['position']): string => {
    switch (pos) {
      case 'top_left':
        return 'top:16px;left:16px;';
      case 'bottom_left':
        return 'bottom:16px;left:16px;';
      default:
        return 'top:16px;right:16px;';
    }
  };

  const close = () => {
    if (closed) return;
    closed = true;
    if (impressionTimer !== null) clearTimeout(impressionTimer);
    if (gateInterval !== null) clearInterval(gateInterval);
    detachBridge?.();
    document.removeEventListener('keydown', onKeyDown, true);
    try {
      overlay.remove();
    } catch {
      // already detached
    }
    restoreScroll();
    opts.handlers.onClose(Math.round((Date.now() - mountedAt) / 1000));
  };

  const renderCloseButton = () => {
    chromeWrap.innerHTML = '';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Close ad');
    btn.style.cssText = [
      'position:absolute',
      positionStyle(behavior.position),
      'width:32px',
      'height:32px',
      'border-radius:50%',
      'border:none',
      'background:rgba(0,0,0,0.6)',
      'color:#fff',
      'font-size:18px',
      'line-height:1',
      'cursor:pointer',
      'pointer-events:auto',
      'display:flex',
      'align-items:center',
      'justify-content:center',
    ].join(';');
    btn.textContent = '✕';
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      close();
    });
    chromeWrap.appendChild(btn);
  };

  const renderGateChrome = (remaining: number) => {
    chromeWrap.innerHTML = '';
    if (behavior.treatment === 'hidden') return;

    if (behavior.treatment === 'progress_bar') {
      const bar = document.createElement('div');
      const pct = delaySeconds > 0 ? Math.min(100, ((delaySeconds - remaining) / delaySeconds) * 100) : 100;
      bar.style.cssText = `position:absolute;top:0;left:0;height:4px;width:${pct}%;background:${behavior.progressBarColor};transition:width 1s linear;`;
      chromeWrap.appendChild(bar);
      return;
    }

    if (behavior.treatment === 'countdown_circle') {
      const size = 36;
      const radius = 15;
      const circumference = 2 * Math.PI * radius;
      const frac = delaySeconds > 0 ? remaining / delaySeconds : 0;
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', String(size));
      svg.setAttribute('height', String(size));
      svg.style.cssText = `position:absolute;${positionStyle(behavior.position)}`;
      svg.innerHTML =
        `<circle cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="rgba(0,0,0,0.6)" stroke="rgba(255,255,255,0.25)" stroke-width="3"/>` +
        `<circle cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="none" stroke="${behavior.progressBarColor}" stroke-width="3" ` +
        `stroke-dasharray="${circumference}" stroke-dashoffset="${circumference * (1 - frac)}" stroke-linecap="round" transform="rotate(-90 ${size / 2} ${size / 2})"/>` +
        `<text x="${size / 2}" y="${size / 2 + 4}" text-anchor="middle" fill="#fff" font-size="13" font-family="sans-serif">${remaining}</text>`;
      chromeWrap.appendChild(svg);
      return;
    }

    // reward_or_close_label
    const pill = document.createElement('div');
    pill.style.cssText = [
      'position:absolute',
      positionStyle(behavior.position),
      'padding:6px 12px',
      'border-radius:16px',
      'background:rgba(0,0,0,0.6)',
      'color:#fff',
      'font:13px sans-serif',
    ].join(';');
    pill.textContent = opts.adUnitType === 'rewarded' ? `Reward in ${remaining}s` : `Close in ${remaining}s`;
    chromeWrap.appendChild(pill);
  };

  // ── Gate ─────────────────────────────────────────────────────────────────
  const finishGate = () => {
    if (gateInterval !== null) {
      clearInterval(gateInterval);
      gateInterval = null;
    }
    renderCloseButton();
    if (!gateFired) {
      gateFired = true;
      opts.handlers.onRewardGateElapsed?.();
      opts.handlers.onCreativeMoment?.('playable_end');
    }
  };

  if (delaySeconds <= 0) {
    finishGate();
  } else {
    let remaining = delaySeconds;
    renderGateChrome(remaining);
    gateInterval = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        finishGate();
      } else {
        renderGateChrome(remaining);
      }
    }, 1000);
  }

  // ── ESC (blocked while the gate is active) ───────────────────────────────
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && gateFired) {
      e.stopPropagation();
      close();
    }
  };
  document.addEventListener('keydown', onKeyDown, true);

  // ── Scroll lock ──────────────────────────────────────────────────────────
  const prevOverflow = document.documentElement.style.overflow;
  document.documentElement.style.overflow = 'hidden';
  const restoreScroll = () => {
    document.documentElement.style.overflow = prevOverflow;
  };

  // ── Creative ─────────────────────────────────────────────────────────────
  detachBridge = attachCreativeBridge(iframe, {
    onEarlyComplete: () => close(),
    onCtaClick: (url) => opts.handlers.onCtaClick(url),
    onCreativeMoment: (moment) => opts.handlers.onCreativeMoment?.(moment),
  });

  iframe.addEventListener('load', () => {
    if (closed) return;
    // Billable impression ~2s after begin-to-render (native parity)
    if (impressionTimer !== null) clearTimeout(impressionTimer);
    impressionTimer = setTimeout(() => {
      impressionTimer = null;
      if (!closed) opts.handlers.onImpression();
    }, IMPRESSION_DELAY_MS);
  });

  try {
    if (opts.creative.renderedHtml) {
      iframe.srcdoc = opts.creative.renderedHtml;
    } else if (opts.creative.iframeUrl) {
      iframe.src = opts.creative.iframeUrl;
    } else {
      // No renderable creative — treat as display failure via close-less path
      restoreScroll();
      return null;
    }
  } catch {
    restoreScroll();
    return null;
  }

  document.body.appendChild(overlay);
  opts.handlers.onDisplayed();

  return { close };
}

/** The bridge message type a creative uses for CTA taps (re-exported for discoverability). */
export { BRIDGE_CTA_CLICK };
