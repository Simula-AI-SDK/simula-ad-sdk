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

/**
 * Process-wide presentation mutex, owned here (native parity: one fullscreen
 * ad at a time, `AlreadyShowing` otherwise). A new presentation properly
 * CLOSES the previous one — its `onClose` handler fires, so lifecycle events
 * (CLOSED, elapsed time, mutex release) are never skipped.
 */
let activeHandle: FullscreenPresenterHandle | null = null;

export function isFullscreenActive(): boolean {
  return activeHandle !== null;
}

/** Test hook. Not public API. */
export function _resetFullscreenForTests(): void {
  activeHandle = null;
}

export function presentFullscreenAd(opts: {
  creative: LoadedCreative;
  adUnitType: AdUnitType;
  closeBehavior?: CloseBehavior;
  handlers: FullscreenPresenterHandlers;
}): FullscreenPresenterHandle | null {
  if (typeof document === 'undefined' || !document.body) return null;

  // Close any live presentation properly (fires its onClose) before mounting
  if (activeHandle) {
    try {
      activeHandle.close();
    } catch {
      // A broken previous presentation must never block a new one
    }
    activeHandle = null;
  }

  // Capture the host's scroll style AFTER the previous presentation closed
  // (its close() already restored the host's true value) — capturing earlier
  // would snapshot the previous ad's own 'hidden' and leak it on our close.
  const prevOverflow = document.documentElement.style.overflow;

  const behavior = opts.closeBehavior ?? opts.creative.adBehavior?.close ?? defaultCloseBehavior();
  const delaySeconds = behavior.delaySeconds;

  // Belt-and-braces: remove stray overlays not owned by a live handle (e.g.
  // the host tore down the page without closing) so scroll locks never leak.
  // Only touch the scroll style when a stray was actually found.
  try {
    const strays = document.querySelectorAll('[data-simula-fullscreen-ad]');
    if (strays.length > 0) {
      strays.forEach((el) => el.remove());
      document.documentElement.style.overflow = prevOverflow;
    }
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

  // srcdoc creatives get an OPAQUE origin (no allow-same-origin): creative JS
  // can never touch the host page's DOM, cookies, or storage (crash-free-host
  // prime directive). Everything the creative needs flows over the bridge.
  // Remote iframeUrl creatives keep their own origin (standard for ads).
  const isSrcdoc = !!opts.creative.renderedHtml;
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'display:block;width:100%;height:100%;border:0;margin:0;padding:0;background:#000;';
  iframe.setAttribute(
    'sandbox',
    isSrcdoc
      ? 'allow-scripts allow-popups allow-popups-to-escape-sandbox'
      : 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox',
  );
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

  // ── Foreground dwell + visibility-aware timers (native parity: Kotlin bills
  // and gates on FOREGROUND-ONLY dwell — a hidden tab must not accrue
  // impression time or burn the reward gate countdown) ───────────────────────
  const isVisible = () => document.visibilityState !== 'hidden';
  let dwellMs = 0;
  let dwellStart: number | null = isVisible() ? Date.now() : null;

  // Pausable impression countdown (started at creative load). Bills exactly
  // once per presentation — a cross-origin creative can fire `load` on every
  // internal navigation, so re-arming is explicitly blocked.
  let impressionRemainingMs: number | null = null;
  let impressionStartedAt = 0;
  let impressionFired = false;
  const startImpressionCountdown = () => {
    if (impressionRemainingMs === null || impressionTimer !== null || closed || impressionFired) return;
    impressionStartedAt = Date.now();
    impressionTimer = setTimeout(() => {
      impressionTimer = null;
      impressionRemainingMs = null;
      impressionFired = true;
      if (!closed) opts.handlers.onImpression();
    }, impressionRemainingMs);
  };
  const pauseImpressionCountdown = () => {
    if (impressionTimer === null || impressionRemainingMs === null) return;
    clearTimeout(impressionTimer);
    impressionTimer = null;
    impressionRemainingMs = Math.max(0, impressionRemainingMs - (Date.now() - impressionStartedAt));
  };

  // Pausable reward/close gate (1s ticks)
  let gateRemaining = delaySeconds;
  const startGateInterval = () => {
    if (gateInterval !== null || gateRemaining <= 0 || closed) return;
    gateInterval = setInterval(() => {
      gateRemaining -= 1;
      if (gateRemaining <= 0) {
        finishGate();
      } else {
        renderGateChrome(gateRemaining);
      }
    }, 1000);
  };
  const pauseGateInterval = () => {
    if (gateInterval === null) return;
    clearInterval(gateInterval);
    gateInterval = null;
  };

  const onVisibilityChange = () => {
    if (isVisible()) {
      if (dwellStart === null) dwellStart = Date.now();
      startImpressionCountdown();
      startGateInterval();
    } else {
      if (dwellStart !== null) {
        dwellMs += Date.now() - dwellStart;
        dwellStart = null;
      }
      pauseImpressionCountdown();
      pauseGateInterval();
    }
  };
  document.addEventListener('visibilitychange', onVisibilityChange);

  const close = () => {
    if (closed) return;
    closed = true;
    if (impressionTimer !== null) clearTimeout(impressionTimer);
    if (gateInterval !== null) clearInterval(gateInterval);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    detachBridge?.();
    document.removeEventListener('keydown', onKeyDown, true);
    try {
      overlay.remove();
    } catch {
      // already detached
    }
    restoreScroll();
    if (activeHandle === handle) activeHandle = null;
    if (dwellStart !== null) {
      dwellMs += Date.now() - dwellStart;
      dwellStart = null;
    }
    opts.handlers.onClose(Math.round(dwellMs / 1000));
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
      const center = size / 2;
      const circumference = 2 * Math.PI * radius;
      const frac = delaySeconds > 0 ? remaining / delaySeconds : 0;

      // Built via DOM APIs (never innerHTML) — no markup injection vector
      const svgNS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(svgNS, 'svg');
      svg.setAttribute('width', String(size));
      svg.setAttribute('height', String(size));
      svg.style.cssText = `position:absolute;${positionStyle(behavior.position)}`;

      const track = document.createElementNS(svgNS, 'circle');
      track.setAttribute('cx', String(center));
      track.setAttribute('cy', String(center));
      track.setAttribute('r', String(radius));
      track.setAttribute('fill', 'rgba(0,0,0,0.6)');
      track.setAttribute('stroke', 'rgba(255,255,255,0.25)');
      track.setAttribute('stroke-width', '3');

      const arc = document.createElementNS(svgNS, 'circle');
      arc.setAttribute('cx', String(center));
      arc.setAttribute('cy', String(center));
      arc.setAttribute('r', String(radius));
      arc.setAttribute('fill', 'none');
      arc.setAttribute('stroke', behavior.progressBarColor);
      arc.setAttribute('stroke-width', '3');
      arc.setAttribute('stroke-dasharray', String(circumference));
      arc.setAttribute('stroke-dashoffset', String(circumference * (1 - frac)));
      arc.setAttribute('stroke-linecap', 'round');
      arc.setAttribute('transform', `rotate(-90 ${center} ${center})`);

      const label = document.createElementNS(svgNS, 'text');
      label.setAttribute('x', String(center));
      label.setAttribute('y', String(center + 4));
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('fill', '#fff');
      label.setAttribute('font-size', '13');
      label.setAttribute('font-family', 'sans-serif');
      label.textContent = String(remaining);

      svg.appendChild(track);
      svg.appendChild(arc);
      svg.appendChild(label);
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
    renderGateChrome(gateRemaining);
    if (isVisible()) startGateInterval();
  }

  // ── ESC (blocked while the gate is active) ───────────────────────────────
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && gateFired) {
      e.stopPropagation();
      close();
    }
  };
  document.addEventListener('keydown', onKeyDown, true);

  // ── Scroll lock (prevOverflow captured at the top, before any cleanup) ───
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
    if (closed || impressionFired) return;
    // Billable impression ~2s of FOREGROUND time after begin-to-render
    if (impressionRemainingMs !== null) return;
    impressionRemainingMs = IMPRESSION_DELAY_MS;
    if (isVisible()) startImpressionCountdown();
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

  const handle: FullscreenPresenterHandle = { close };
  activeHandle = handle;
  return handle;
}

/** The bridge message type a creative uses for CTA taps (re-exported for discoverability). */
export { BRIDGE_CTA_CLICK };
