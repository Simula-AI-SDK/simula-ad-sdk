export { SimulaProvider, useSimula } from './SimulaProvider';
export { InChatAdSlot } from './components/inChatAd/InChatAdSlot';
export { MiniGameMenu } from './components/miniGame/MiniGameMenu';
export { NativeBanner } from './components/nativeBanner/NativeBanner';
export { RadialLinesSpinner } from './components/nativeBanner/RadialLinesSpinner';
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

// Privacy utilities
export { filterContextForPrivacy } from './types';

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
  NativeContext,
  NativeBannerProps,
} from './types';