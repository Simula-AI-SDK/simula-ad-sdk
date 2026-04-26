import React, { useContext, useEffect } from 'react';
import { SimulaImperativeContext } from '../../imperative/SimulaImperativeContext';

/**
 * Internal-only middle-phase invitation for the imperative
 * SimulaMiniGameInterstitial flow. Shown between the fullscreen
 * MiniGameInterstitial CTA and the playable sponsored game.
 *
 * Patterned after `RewardInvitation.tsx`: same two-button card shell, same
 * accessibility rigging. Unlike `RewardInvitation`, this component is wired
 * to the imperative SimulaImperativeContext — Accept advances the manager
 * to the game phase; Dismiss emits CLOSED and tears down.
 *
 * NOT exported from `src/index.ts`. Declarative consumers should continue
 * to use `RewardInvitation` / build their own invite card.
 *
 * @internal
 */
interface InterstitialFullGameInvitationProps {
  isOpen: boolean;
  charImage: string;
  charName: string;
  charLabel?: string;
  titleText?: string;
  subText?: string;
  ctaText?: string;
  closeText?: string;
}

export function InterstitialFullGameInvitation({
  isOpen,
  charImage,
  charName,
  charLabel = 'Game Partner',
  titleText = 'Ready to play?',
  subText = 'Jump into a quick game with your companion.',
  ctaText = 'Play Now',
  closeText = 'Not Now',
}: InterstitialFullGameInvitationProps) {
  const imperativeCtx = useContext(SimulaImperativeContext);

  // ESC-to-dismiss — matches the dismiss contract on the other imperative
  // surfaces (MiniGameInterstitial, MiniGameMenu, GameIframe).
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        imperativeCtx?.onEvent('CLOSED', null);
        imperativeCtx?.onImperativeClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, imperativeCtx]);

  if (!isOpen) return null;

  const handleAccept = () => {
    // Imperative flow: advance the manager phase machine to 'game'. Do NOT
    // emit CLICKED here — CLICKED fires on the fullscreen CTA, not on this
    // middle invite.
    imperativeCtx?.onImperativeAdvance?.('fullInvitation:accept');
  };

  const handleDismiss = () => {
    imperativeCtx?.onEvent('CLOSED', null);
    imperativeCtx?.onImperativeClose();
  };

  return (
    <>
      <style>{css}</style>
      <div
        className="ifgi-shell"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ifgi-partner-label ifgi-heading"
        aria-describedby="ifgi-body"
      >
        <div className="ifgi-popup">
          <div className="ifgi-game-partner" id="ifgi-partner-label">
            <img
              className="ifgi-game-partner-photo"
              src={charImage}
              alt={charName}
            />
            <div className="ifgi-game-partner-text">
              <span className="ifgi-game-partner-prefix">{charLabel}</span>
              <span className="ifgi-game-partner-name">{charName}</span>
            </div>
          </div>

          <p id="ifgi-heading">{titleText}</p>
          <p id="ifgi-body">{subText}</p>

          <div className="ifgi-popup-actions">
            <button
              type="button"
              className="ifgi-btn-primary"
              aria-label={`${ctaText} – ${charName}`}
              onClick={handleAccept}
            >
              <svg
                className="ifgi-play-icon"
                viewBox="0 0 24 24"
                width={26}
                height={26}
                fill="currentColor"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path d="M8 5.82v12.36L18.18 12 8 5.82z" />
              </svg>
              {ctaText}
            </button>
            <button
              type="button"
              className="ifgi-btn-secondary"
              onClick={handleDismiss}
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
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');

  .ifgi-shell {
    position: fixed;
    inset: 0;
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px 18px;
    padding-bottom: max(24px, env(safe-area-inset-bottom, 0px));
    padding-top: max(24px, env(safe-area-inset-top, 0px));
    background: rgba(0, 0, 0, 0.55);
    font-family: "Inter", -apple-system, "SF Pro Display", "SF Pro Text", system-ui, Roboto, Arial, sans-serif;
    color: #fff;
  }

  .ifgi-popup {
    width: 100%;
    max-width: 340px;
    padding: 28px 26px 30px;
    border-radius: 20px;
    background: rgba(18, 20, 28, 0.92);
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow:
      0 24px 48px rgba(0, 0, 0, 0.45),
      0 0 0 1px rgba(255, 255, 255, 0.04) inset;
    text-align: center;
  }

  .ifgi-game-partner {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    margin-bottom: 24px;
    text-align: left;
  }

  .ifgi-game-partner-photo {
    width: 76px;
    height: 76px;
    border-radius: 20px;
    object-fit: cover;
    flex-shrink: 0;
    border: 2px solid rgba(120, 200, 255, 0.22);
    box-shadow: 0 12px 28px rgba(0, 0, 0, 0.4);
  }

  .ifgi-game-partner-text {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .ifgi-game-partner-prefix {
    display: block;
    font-size: 14px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.52);
  }

  .ifgi-game-partner-name {
    display: block;
    font-size: 22px;
    font-weight: 800;
    letter-spacing: -0.03em;
    color: rgba(255, 255, 255, 0.95);
  }

  .ifgi-popup p {
    font-size: 17px;
    font-weight: 600;
    line-height: 1.45;
    letter-spacing: -0.02em;
    color: rgba(255, 255, 255, 0.96);
  }

  .ifgi-popup p + p {
    margin-top: 18px;
    font-size: 16px;
    font-weight: 400;
    color: rgba(255, 255, 255, 0.82);
    line-height: 1.5;
  }

  .ifgi-popup-actions {
    margin-top: 26px;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 14px;
  }

  .ifgi-btn-primary {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    width: 100%;
    padding: 15px 20px;
    border-radius: 14px;
    border: 1px solid rgba(120, 200, 255, 0.28);
    background: linear-gradient(180deg, rgba(99, 102, 241, 0.5) 0%, rgba(59, 130, 246, 0.32) 100%);
    color: #fff;
    font-family: inherit;
    font-size: 15px;
    font-weight: 800;
    letter-spacing: -0.02em;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.35);
  }

  .ifgi-btn-primary:hover {
    background: linear-gradient(180deg, rgba(99, 102, 241, 0.6) 0%, rgba(59, 130, 246, 0.42) 100%);
  }

  .ifgi-btn-primary:active {
    transform: scale(0.99);
  }

  .ifgi-play-icon {
    width: 26px;
    height: 26px;
    flex-shrink: 0;
    display: block;
  }

  .ifgi-btn-secondary {
    align-self: center;
    padding: 6px 12px;
    margin: 0;
    border: none;
    background: none;
    font-family: inherit;
    font-size: 15px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.55);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    text-decoration: underline;
    text-underline-offset: 4px;
  }

  .ifgi-btn-secondary:hover {
    color: rgba(255, 255, 255, 0.78);
  }
`;
