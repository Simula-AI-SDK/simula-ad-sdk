import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  RewardInvitationAnimation,
  RewardInvitationProps,
  RewardInvitationTheme,
} from '../../types';

const ANIMATION_DURATION = 280; // ms — must match the keyframes below

const defaultTheme: Required<RewardInvitationTheme> = {
  accentColor: '#F45B69',
  backgroundColor:
    'radial-gradient(120% 80% at 50% 0%, rgba(244, 91, 105, 0.18) 0%, transparent 60%), linear-gradient(180deg, rgba(28, 28, 32, 0.96) 0%, rgba(18, 18, 22, 0.98) 100%)',
  overlayColor: 'rgba(0, 0, 0, 0.7)',
  borderColor: 'rgba(255, 255, 255, 0.08)',
  cornerRadius: 24,
  ctaCornerRadius: 9999,
  charImageCornerRadius: 18,
  textColor: '#FFFFFF',
  fontFamily:
    '"Inter", -apple-system, "SF Pro Display", "SF Pro Text", system-ui, Roboto, Arial, sans-serif',
};

/** Convert a hex color (#rrggbb / #rgb) to "r, g, b" — used to build rgba() with theme colors. */
function hexToRgbTriplet(hex: string): string | null {
  const trimmed = hex.trim().replace(/^#/, '');
  const expanded =
    trimmed.length === 3
      ? trimmed
          .split('')
          .map((c) => c + c)
          .join('')
      : trimmed;
  if (expanded.length !== 6 || /[^0-9a-f]/i.test(expanded)) return null;
  const r = parseInt(expanded.slice(0, 2), 16);
  const g = parseInt(expanded.slice(2, 4), 16);
  const b = parseInt(expanded.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

/** Try to produce an `rgba(r,g,b,a)` from a hex color. Falls back to the raw value if not hex. */
function withAlpha(color: string, alpha: number): string {
  const triplet = hexToRgbTriplet(color);
  if (triplet) return `rgba(${triplet}, ${alpha})`;
  return color;
}

export function RewardInvitation({
  isOpen,
  charImage,
  charName,
  onClick,
  onClose,
  charLabel = 'Game Partner',
  titleText = "You've Run Out of Free Messages Today",
  subText = 'Play a quick game to unlock free messaging for the rest of the day?',
  ctaText = 'Play Now',
  closeText = 'No Thanks',
  theme,
  animation = 'pop',
  dismissOnBackdrop = true,
  dismissOnEsc = true,
}: RewardInvitationProps) {
  const [shouldRender, setShouldRender] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const closingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applied = { ...defaultTheme, ...theme };
  const accent = applied.accentColor;
  const accentGlow = withAlpha(accent, 0.45);
  const accentSoft = withAlpha(accent, 0.18);
  const accentBorder = withAlpha(accent, 0.55);
  const subTextColor = withAlpha(applied.textColor, 0.7);
  const labelColor = withAlpha(accent, 0.9);

  // Drive a darker shade for the CTA gradient bottom — try to derive from the accent,
  // otherwise reuse it.
  const accentDark = (() => {
    const triplet = hexToRgbTriplet(accent);
    if (!triplet) return accent;
    const [r, g, b] = triplet.split(',').map((s) => parseInt(s.trim(), 10));
    const darken = (n: number) => Math.max(0, Math.round(n * 0.82));
    return `rgb(${darken(r)}, ${darken(g)}, ${darken(b)})`;
  })();
  const accentLight = (() => {
    const triplet = hexToRgbTriplet(accent);
    if (!triplet) return accent;
    const [r, g, b] = triplet.split(',').map((s) => parseInt(s.trim(), 10));
    const lighten = (n: number) => Math.min(255, Math.round(n + (255 - n) * 0.18));
    return `rgb(${lighten(r)}, ${lighten(g)}, ${lighten(b)})`;
  })();

  // ---- open/close state machine ----
  const clearClosingTimer = useCallback(() => {
    if (closingTimerRef.current) {
      clearTimeout(closingTimerRef.current);
      closingTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      clearClosingTimer();
      setIsClosing(false);
      setShouldRender(true);
    } else if (shouldRender) {
      // Parent flipped isOpen -> false; play exit animation then unmount.
      if (animation === 'none') {
        setShouldRender(false);
        return;
      }
      setIsClosing(true);
      closingTimerRef.current = setTimeout(() => {
        setShouldRender(false);
        setIsClosing(false);
      }, ANIMATION_DURATION);
    }
    return () => {
      // Cleanup happens on the next isOpen flip; nothing to do here.
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => () => clearClosingTimer(), [clearClosingTimer]);

  const requestClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // ---- ESC + scroll lock ----
  useEffect(() => {
    if (!shouldRender || isClosing) return;
    if (!dismissOnEsc) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [shouldRender, isClosing, dismissOnEsc, requestClose]);

  useEffect(() => {
    if (!shouldRender) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [shouldRender]);

  if (!shouldRender) return null;

  const useEntryAnim = animation !== 'none' && !isClosing;
  const useExitAnim = animation !== 'none' && isClosing;

  const popupAnimName =
    animation === 'fade'
      ? useExitAnim
        ? 'ri-fade-out'
        : 'ri-fade-in'
      : useExitAnim
        ? 'ri-pop-out'
        : 'ri-pop-in';
  const backdropAnimName = useExitAnim ? 'ri-fade-out' : 'ri-fade-in';

  const cssVars: React.CSSProperties = {
    // Theme tokens consumed by the CSS below
    ['--ri-accent' as string]: accent,
    ['--ri-accent-light' as string]: accentLight,
    ['--ri-accent-dark' as string]: accentDark,
    ['--ri-accent-glow' as string]: accentGlow,
    ['--ri-accent-soft' as string]: accentSoft,
    ['--ri-accent-border' as string]: accentBorder,
    ['--ri-overlay' as string]: applied.overlayColor,
    ['--ri-bg' as string]: applied.backgroundColor,
    ['--ri-border' as string]: applied.borderColor,
    ['--ri-radius' as string]: `${applied.cornerRadius}px`,
    ['--ri-cta-radius' as string]: `${applied.ctaCornerRadius}px`,
    ['--ri-char-radius' as string]: `${applied.charImageCornerRadius}px`,
    ['--ri-text' as string]: applied.textColor,
    ['--ri-subtext' as string]: subTextColor,
    ['--ri-label' as string]: labelColor,
    ['--ri-font' as string]: applied.fontFamily,
  };

  return (
    <>
      <style>{css}</style>
      <div
        className={`ri-shell${useEntryAnim ? ' ri-shell--entering' : ''}${useExitAnim ? ' ri-shell--exiting' : ''}`}
        style={cssVars}
      >
        <div
          className="ri-backdrop"
          aria-hidden="true"
          onClick={dismissOnBackdrop ? requestClose : undefined}
          style={{ animation: animation !== 'none' ? `${backdropAnimName} ${ANIMATION_DURATION}ms ease-out forwards` : undefined }}
        />
        <div
          className="ri-popup"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ri-partner-label ri-heading"
          aria-describedby="ri-body"
          style={{ animation: animation !== 'none' ? `${popupAnimName} ${ANIMATION_DURATION}ms cubic-bezier(0.22, 1, 0.36, 1) forwards` : undefined }}
        >
          <div className="ri-game-partner" id="ri-partner-label">
            <img
              className="ri-game-partner-photo"
              src={charImage}
              alt={charName}
            />
            <div className="ri-game-partner-text">
              <span className="ri-game-partner-prefix">{charLabel}</span>
              <span className="ri-game-partner-name">{charName}</span>
            </div>
          </div>

          <p id="ri-heading">{titleText}</p>
          <p id="ri-body">{subText}</p>

          <div className="ri-popup-actions">
            <button
              type="button"
              className="ri-btn-primary"
              aria-label={`${ctaText} – ${charName}`}
              onClick={onClick}
            >
              <span className="ri-btn-primary-shimmer" aria-hidden="true" />
              <svg
                className="ri-play-icon"
                viewBox="0 0 24 24"
                width={18}
                height={18}
                fill="currentColor"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path d="M8 5.82v12.36L18.18 12 8 5.82z" />
              </svg>
              <span className="ri-btn-primary-label">{ctaText}</span>
            </button>
            <button
              type="button"
              className="ri-btn-secondary"
              onClick={requestClose}
            >
              {closeText}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

  @keyframes ri-fade-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  @keyframes ri-fade-out {
    from { opacity: 1; }
    to   { opacity: 0; }
  }

  @keyframes ri-pop-in {
    from { opacity: 0; transform: translateY(12px) scale(0.94); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }

  @keyframes ri-pop-out {
    from { opacity: 1; transform: translateY(0) scale(1); }
    to   { opacity: 0; transform: translateY(8px) scale(0.96); }
  }

  @keyframes ri-glow-pulse {
    0%, 100% {
      box-shadow:
        0 0 0 0 var(--ri-accent-glow, rgba(244, 91, 105, 0.45)),
        0 18px 40px rgba(0, 0, 0, 0.35);
    }
    50% {
      box-shadow:
        0 0 0 8px rgba(244, 91, 105, 0),
        0 22px 50px rgba(0, 0, 0, 0.4);
    }
  }

  @keyframes ri-shimmer {
    0%   { transform: translateX(-120%) skewX(-18deg); }
    100% { transform: translateX(220%) skewX(-18deg); }
  }

  .ri-shell {
    position: fixed;
    inset: 0;
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px 18px;
    padding-bottom: max(24px, env(safe-area-inset-bottom, 0px));
    padding-top: max(24px, env(safe-area-inset-top, 0px));
    font-family: var(--ri-font);
    color: var(--ri-text);
  }

  .ri-backdrop {
    position: absolute;
    inset: 0;
    background-color: var(--ri-overlay);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    cursor: pointer;
  }

  .ri-popup {
    position: relative;
    width: 100%;
    max-width: 360px;
    padding: 30px 26px 26px;
    border-radius: var(--ri-radius);
    background: var(--ri-bg);
    border: 1px solid var(--ri-border);
    box-shadow:
      0 30px 80px rgba(0, 0, 0, 0.55),
      0 0 0 1px rgba(255, 255, 255, 0.04) inset,
      0 1px 0 rgba(255, 255, 255, 0.06) inset;
    text-align: center;
    overflow: hidden;
  }

  .ri-popup::before {
    content: "";
    position: absolute;
    top: -1px;
    left: 10%;
    right: 10%;
    height: 1px;
    background: linear-gradient(
      90deg,
      transparent,
      var(--ri-accent),
      transparent
    );
    opacity: 0.7;
    pointer-events: none;
  }

  .ri-game-partner {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 14px;
    margin-bottom: 20px;
    text-align: left;
  }

  .ri-game-partner-photo {
    width: 68px;
    height: 68px;
    border-radius: var(--ri-char-radius);
    object-fit: cover;
    flex-shrink: 0;
    border: 2px solid var(--ri-accent-border);
    box-shadow:
      0 0 0 4px var(--ri-accent-soft),
      0 12px 28px rgba(0, 0, 0, 0.45);
  }

  .ri-game-partner-text {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .ri-game-partner-prefix {
    display: block;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--ri-label);
  }

  .ri-game-partner-name {
    display: block;
    font-size: 22px;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: var(--ri-text);
  }

  .ri-popup p {
    margin: 0;
  }

  .ri-popup p#ri-heading {
    font-size: 18px;
    font-weight: 700;
    line-height: 1.35;
    letter-spacing: -0.01em;
    color: var(--ri-text);
    margin-top: 4px;
  }

  .ri-popup p#ri-body {
    margin-top: 10px;
    font-size: 14px;
    font-weight: 400;
    line-height: 1.55;
    color: var(--ri-subtext);
  }

  .ri-popup-actions {
    margin-top: 22px;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }

  .ri-btn-primary {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    width: 100%;
    padding: 14px 20px;
    border: none;
    border-radius: var(--ri-cta-radius);
    background: linear-gradient(180deg, var(--ri-accent-light) 0%, var(--ri-accent) 55%, var(--ri-accent-dark) 100%);
    color: #fff;
    font-family: inherit;
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 0.01em;
    cursor: pointer;
    overflow: hidden;
    -webkit-tap-highlight-color: transparent;
    animation: ri-glow-pulse 2.4s ease-in-out infinite;
    transition: transform 0.15s ease, filter 0.15s ease;
  }

  .ri-btn-primary:hover {
    filter: brightness(1.05);
    transform: translateY(-1px);
  }

  .ri-btn-primary:active {
    transform: translateY(0) scale(0.99);
  }

  .ri-btn-primary-shimmer {
    position: absolute;
    top: 0;
    left: 0;
    width: 40%;
    height: 100%;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(255, 255, 255, 0.35),
      transparent
    );
    animation: ri-shimmer 2.8s ease-in-out infinite;
    pointer-events: none;
  }

  .ri-btn-primary-label {
    position: relative;
    z-index: 1;
  }

  .ri-play-icon {
    position: relative;
    z-index: 1;
    width: 18px;
    height: 18px;
    flex-shrink: 0;
    display: block;
    margin-right: -2px;
  }

  .ri-btn-secondary {
    align-self: center;
    margin: 4px 0 0;
    padding: 8px 12px;
    border: none;
    background: none;
    font-family: inherit;
    font-size: 14px;
    font-weight: 500;
    color: var(--ri-subtext);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: color 0.15s ease;
  }

  .ri-btn-secondary:hover {
    color: var(--ri-text);
  }

  @media (prefers-reduced-motion: reduce) {
    .ri-popup,
    .ri-backdrop {
      animation: none !important;
    }
    .ri-btn-primary {
      animation: none !important;
    }
    .ri-btn-primary-shimmer {
      display: none;
    }
  }
`;
