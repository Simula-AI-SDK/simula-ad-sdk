import React, { useState, useEffect, useRef } from 'react';
import { SponsoredSuggestionsProps, SponsoredSuggestionData } from '../../types';
import { createSponsoredSuggestionsCSS } from '../../utils/styling';

// Dummy data for sponsored suggestions - single suggestion for now
const DUMMY_SUGGESTION: SponsoredSuggestionData = {
  id: 'sponsored-suggestion-1',
  title: 'Premium Gaming Experience',
  description: 'Discover the latest games and exclusive content',
  iframeUrl: 'https://example.com/sponsored-suggestion',
  imageUrl: 'https://via.placeholder.com/300x200?text=Sponsored+Suggestion'
};

export const SponsoredSuggestions: React.FC<SponsoredSuggestionsProps> = (props) => {
  const {
    theme = {},
    onSuggestionClick,
    onImpression,
  } = props;

  const [showInfoModal, setShowInfoModal] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const styleElementRef = useRef<HTMLStyleElement | null>(null);
  const suggestion = DUMMY_SUGGESTION;

  // Track impression when iframe loads
  useEffect(() => {
    if (iframeLoaded && onImpression) {
      onImpression(suggestion);
    }
  }, [iframeLoaded, onImpression, suggestion]);

  // Apply theme styles
  useEffect(() => {
    // Create style element once on mount
    if (!styleElementRef.current) {
      styleElementRef.current = document.createElement('style');
      styleElementRef.current.setAttribute('data-simula-sponsored-suggestions-styles', 'true');
      document.head.appendChild(styleElementRef.current);
    }

    // Update CSS content whenever theme changes
    const css = createSponsoredSuggestionsCSS(theme);
    styleElementRef.current.textContent = css;

    // Cleanup only on unmount
    return () => {
      if (styleElementRef.current && document.head.contains(styleElementRef.current)) {
        document.head.removeChild(styleElementRef.current);
        styleElementRef.current = null;
      }
    };
  }, [theme]);

  const handleIframeLoad = () => {
    setIframeLoaded(true);
  };

  const handleSuggestionClick = () => {
    onSuggestionClick?.(suggestion);
  };

  // Calculate height from theme
  const getHeightCSS = () => {
    const height = theme.height;
    if (!height) {
      return '400px'; // Default height
    }
    if (typeof height === 'string') {
      return height;
    }
    return `${height}px`;
  };

  // Calculate width from theme
  const getWidthCSS = () => {
    const width = theme.width;
    if (!width || width === 'auto') {
      return '100%';
    }
    if (typeof width === 'string') {
      return width;
    }
    return `${width}px`;
  };

  return (
    <div
      className="simula-sponsored-suggestions"
      style={{
        width: getWidthCSS(),
        minWidth: '320px',
        height: getHeightCSS(),
      }}
    >
      <div
        className="simula-sponsored-suggestion-slot"
        onClick={handleSuggestionClick}
        style={{ cursor: onSuggestionClick ? 'pointer' : 'default' }}
      >
        <iframe
          src={suggestion.iframeUrl}
          className="simula-sponsored-suggestion-frame"
          style={{
            display: 'block',
            verticalAlign: 'top',
            border: 0,
            margin: 0,
            padding: 0,
            width: '100%',
            height: '100%',
          }}
          frameBorder="0"
          scrolling="no"
          allowTransparency={true}
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          title={`Sponsored Suggestion: ${suggestion.title}`}
          onLoad={handleIframeLoad}
        />
      </div>
      <button
        className="simula-info-icon"
        onClick={(e) => {
          e.stopPropagation();
          setShowInfoModal(true);
        }}
        aria-label="Content information"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1" fill="none"/>
          <text x="8" y="12" textAnchor="middle" fontSize="10" fontFamily="serif">i</text>
        </svg>
      </button>
      {showInfoModal && (
        <div className="simula-modal-overlay" onClick={() => setShowInfoModal(false)}>
          <div className="simula-modal-content" onClick={(e) => e.stopPropagation()}>
            <button 
              className="simula-modal-close"
              onClick={() => setShowInfoModal(false)}
              aria-label="Close"
            >
              ×
            </button>
            <p>
              Powered by{' '}
              <a
                href="https://simula.ad"
                target="_blank"
                rel="noopener noreferrer"
                className="simula-modal-link"
              >
                Simula
              </a>
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

