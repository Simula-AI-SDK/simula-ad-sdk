export { SimulaProvider, useSimula } from './SimulaProvider';
export { InChatAdSlot } from './InChatAdSlot';
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
  SimulaTheme,
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
  FontPalette
} from './types';