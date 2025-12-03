export { SimulaProvider, useSimula } from './SimulaProvider';
export { InChatAdSlot } from './components/inChatAd/InChatAdSlot';
export { MiniGameMenu } from './components/miniGame/MiniGameMenu';
export { SponsoredSuggestions } from './components/sponsoredSuggestions/SponsoredSuggestions';
export { useBotDetection } from './hooks/useBotDetection';
export { useViewability } from './hooks/useViewability';
export { useOMIDViewability } from './hooks/useOMIDViewability';

// Theme utilities
export { 
  getColorTheme, 
  getFontStyles, 
  fonts,
  getBackgroundGradient,
  getSolidBackground,
  getTextMuted,
  getTextSecondary,
  getBorderLight,
  getShadow
} from './utils/colorThemes';

// Test utilities (removed)

export type {
  InChatTheme,
  Message,
  AdData,
  InChatAdSlotProps,
  SimulaProviderProps,
  SimulaContextValue,
  BotDetectionResult,
  ViewabilityOptions,
  ViewabilityResult,
  OMIDViewabilityOptions,
  OMIDViewabilityResult,
  ColorPalette,
  FontPalette,
  MiniGameTheme,
  MiniGameMenuProps,
  GameData,
  SponsoredSuggestionsTheme,
  SponsoredSuggestionData,
  SponsoredSuggestionsProps
} from './types';