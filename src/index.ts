export { SimulaProvider, useSimula } from './SimulaProvider';
export { InChatAdSlot } from './components/inChatAd/InChatAdSlot';
export { MiniGameMenu } from './components/miniGame/MiniGameMenu';
export { MiniGameInvitation } from './components/miniGame/MiniGameInvitation';
export { MiniGameButton } from './components/miniGame/MiniGameButton';
export { MiniGameInterstitial } from './components/miniGame/MiniGameInterstitial';

// MiniGameInviteKit — grouped access to mini game invite components
import { MiniGameInvitation as _Invitation } from './components/miniGame/MiniGameInvitation';
import { MiniGameButton as _Button } from './components/miniGame/MiniGameButton';
import { MiniGameInterstitial as _Interstitial } from './components/miniGame/MiniGameInterstitial';

export const MiniGameInviteKit = {
  Invitation: _Invitation,
  Button: _Button,
  Interstitial: _Interstitial,
} as const;
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
  MiniGameInvitationTheme,
  MiniGameInvitationProps,
  MiniGameInvitationAnimation,
  MiniGameNavigationType,
  MiniGameButtonTheme,
  MiniGameButtonProps,
  MiniGameInterstitialTheme,
  MiniGameInterstitialProps,
  NativeContext,
  NativeBannerProps,
} from './types';