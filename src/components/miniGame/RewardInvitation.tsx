import React from 'react';

interface RewardInvitationProps {
  isOpen: boolean;
  charImage: string;
  charName: string;
  onClick: () => void;
  onClose: () => void;
  charLabel?: string;
  titleText?: string;
  subText?: string;
  ctaText?: string;
  closeText?: string;
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
}: RewardInvitationProps) {
  if (!isOpen) return null;

  return (
    <>
      <style>{css}</style>
      <div
        className="ri-shell"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ri-partner-label ri-heading"
        aria-describedby="ri-body"
      >
        <div className="ri-popup">
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
              <svg
                className="ri-play-icon"
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
              className="ri-btn-secondary"
              onClick={onClose}
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
    font-family: "Inter", -apple-system, "SF Pro Display", "SF Pro Text", system-ui, Roboto, Arial, sans-serif;
    color: #fff;
  }

  .ri-popup {
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

  .ri-game-partner {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    margin-bottom: 24px;
    text-align: left;
  }

  .ri-game-partner-photo {
    width: 76px;
    height: 76px;
    border-radius: 20px;
    object-fit: cover;
    flex-shrink: 0;
    border: 2px solid rgba(120, 200, 255, 0.22);
    box-shadow: 0 12px 28px rgba(0, 0, 0, 0.4);
  }

  .ri-game-partner-text {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .ri-game-partner-prefix {
    display: block;
    font-size: 14px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.52);
  }

  .ri-game-partner-name {
    display: block;
    font-size: 22px;
    font-weight: 800;
    letter-spacing: -0.03em;
    color: rgba(255, 255, 255, 0.95);
  }

  .ri-popup p {
    font-size: 17px;
    font-weight: 600;
    line-height: 1.45;
    letter-spacing: -0.02em;
    color: rgba(255, 255, 255, 0.96);
  }

  .ri-popup p + p {
    margin-top: 18px;
    font-size: 16px;
    font-weight: 400;
    color: rgba(255, 255, 255, 0.82);
    line-height: 1.5;
  }

  .ri-popup-actions {
    margin-top: 26px;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 14px;
  }

  .ri-btn-primary {
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

  .ri-btn-primary:hover {
    background: linear-gradient(180deg, rgba(99, 102, 241, 0.6) 0%, rgba(59, 130, 246, 0.42) 100%);
  }

  .ri-btn-primary:active {
    transform: scale(0.99);
  }

  .ri-play-icon {
    width: 26px;
    height: 26px;
    flex-shrink: 0;
    display: block;
  }

  .ri-btn-secondary {
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

  .ri-btn-secondary:hover {
    color: rgba(255, 255, 255, 0.78);
  }
`;
