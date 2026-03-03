export type AccentOption = 'blue' | 'red' | 'green' | 'yellow' | 'purple' | 'pink' | 'orange' | 'neutral' | 'gray' | 'tan' | 'transparent' | 'image';
export type FontOption = 'sans-serif' | 'serif' | 'monospace';

export interface InChatTheme {
  mode?: 'light' | 'dark' | 'auto';
  theme?: 'light' | 'dark' | 'auto'; // Deprecated: use 'mode' instead. Kept for backward compatibility.
  accent?: AccentOption | AccentOption[];
  font?: FontOption | FontOption[];
  width?: number | string;
  cornerRadius?: number;
}

export interface ColorPalette {
  // Background gradient colors
  backgroundGradient1: string;  // Start color of gradient
  backgroundGradient2: string;  // End color of gradient
  
  // Main colors
  primary: string;
  primaryHover: string;
  secondary: string;
  
  // Text and borders
  text: string;
  border: string;
  
  // Button text (usually white, but black for yellow)
  buttonText: string;
}

export interface FontPalette {
  primary: string;
  secondary: string;
}

export interface Message {
  role: string;
  content: string;
}

export interface AdData {
  id: string;
  format: string;
  iframeUrl?: string;
  html?: string; // Direct HTML content for rendering (alternative to iframeUrl)
}

export interface InChatAdSlotProps {
  messages: Message[];
  trigger?: Promise<any>;
  formats?: string | string[]; // Deprecated: ignored. Kept for backward compatibility.
  theme?: InChatTheme;
  debounceMs?: number;
  charDesc?: string;
  onFill?: (ad: AdData) => void;
  onRender?: (ad: AdData) => void;
  onImpression?: (ad: AdData) => void;
  onClick?: (ad: AdData) => void;
  onError?: (error: Error) => void;
}

export interface SimulaProviderProps {
  apiKey: string;
  children: React.ReactNode;
  devMode?: boolean;
  primaryUserID?: string;
  /** Privacy consent flag. When false, suppresses collection of PII (primaryUserID). Defaults to true. */
  hasPrivacyConsent?: boolean;
}

export interface SimulaContextValue {
  apiKey: string;
  devMode: boolean;
  sessionId?: string;
  /** Privacy consent flag. When false, PII should not be collected. */
  hasPrivacyConsent: boolean;
  /** Get cached ad for a slot/position */
  getCachedAd: (slot: string, position: number) => AdData | null;
  /** Cache an ad for a slot/position */
  cacheAd: (slot: string, position: number, ad: AdData) => void;
  /** Get cached height for a slot/position */
  getCachedHeight: (slot: string, position: number) => number | null;
  /** Cache height for a slot/position */
  cacheHeight: (slot: string, position: number, height: number) => void;
  /** Check if a slot/position has no fill */
  hasNoFill: (slot: string, position: number) => boolean;
  /** Mark a slot/position as having no fill */
  markNoFill: (slot: string, position: number) => void;
}

export interface BotDetectionResult {
  isBot: boolean;
  reasons: string[];
}

export interface OMIDViewabilityOptions {
  threshold?: number;
  durationMs?: number;
  partnerName?: string;
  partnerVersion?: string;
  onImpressionTracked?: (adId: string) => void;
}

export interface OMIDViewabilityResult {
  isViewable: boolean;
  hasBeenViewed: boolean;
  impressionTracked: boolean;
}

export interface ViewabilityOptions {
  threshold?: number;
  durationMs?: number;
  onImpressionTracked?: (adId: string) => void;
}

export interface ViewabilityResult {
  isViewable: boolean;
  isInstantViewable: boolean;
  hasBeenViewed: boolean;
  impressionTracked: boolean;
}

// MiniGameMenu types
export interface MiniGameTheme {
  backgroundColor?: string;
  headerColor?: string;
  borderColor?: string;
  titleFont?: string;
  secondaryFont?: string;
  titleFontColor?: string;
  secondaryFontColor?: string;
  iconCornerRadius?: number;
  /** Unified accent color for interactive elements (search bar focus, pagination). Default: '#3B82F6' (blue-500) */
  accentColor?: string;
  /** 
   * Controls the height of the Mini Game iframe (not the ad).
   * - number: pixel value (e.g., 500 = 500px)
   * - string with %: percentage of screen height (e.g., "80%")
   * - undefined/null: full screen (default behavior)
   * Minimum height is 500px.
   */
  playableHeight?: number | string;
  /** 
   * Controls the background color of the curved border area above the playable
   * when playableHeight is set (bottom sheet mode). Default: '#262626'
   */
  playableBorderColor?: string;
}

export interface GameData {
  id: string;
  name: string;
  iconUrl: string;
  description: string;
  iconFallback?: string; // Optional fallback emoji (defaults to 🎮)
}

export interface MiniGameMenuProps {
  isOpen: boolean;
  onClose: () => void;
  charName: string;
  charID: string;
  charImage: string;
  messages?: Message[];
  charDesc?: string;
  maxGamesToShow?: 3 | 6 | 9;
  theme?: MiniGameTheme;
  delegateChar?: boolean; // Whether Simula should display the AI character within the iframe (default: true)
}

// MiniGameInvitation types
export type MiniGameInvitationAnimation = 'auto' | 'slideDown' | 'fadeIn' | 'slideUp' | 'none';

export interface MiniGameInvitationTheme {
  cornerRadius?: number;
  backgroundColor?: string;
  textColor?: string;
  titleTextColor?: string;
  subTextColor?: string;
  ctaTextColor?: string;
  ctaColor?: string;
  charImageCornerRadius?: number;
  /** Which side the character image appears on. Default: 'left'. */
  charImageAnchor?: 'left' | 'right';
  borderWidth?: number;
  borderColor?: string;
  fontFamily?: string;
}

export interface MiniGameInvitationProps {
  titleText?: string;
  subText?: string;
  ctaText?: string;
  charImage: string;
  animation?: MiniGameInvitationAnimation;
  theme?: MiniGameInvitationTheme;
  isOpen?: boolean;
  /** Milliseconds before auto-close. undefined = no auto-close. */
  autoCloseDuration?: number;
  /**
   * Component width. Supports multiple formats:
   * - number < 1: percentage as decimal (e.g., 0.8 = 80%)
   * - number >= 1: pixels (e.g., 500 = 500px)
   * - string with %: percentage (e.g., "80%" = 80%)
   * - string with number: pixels (e.g., "500" = 500px)
   * - null/undefined: fills container width (100%)
   */
  width?: number | string | null;
  /**
   * Distance from top of viewport. The invitation is always fixed and horizontally centered.
   * - number < 1: percentage (e.g., 0.05 = 5%)
   * - number >= 1: pixels (e.g., 20 = 20px)
   * - string with %: percentage (e.g., "5%")
   * - string with number: pixels (e.g., "20")
   * Defaults to 0.05 (5% from top).
   */
  top?: number | string;
  /** CTA button click handler. */
  onClick: () => void;
  /** Optional callback when the invitation closes (dismiss, auto-close, or after CTA click). Component closes itself internally regardless. */
  onClose?: () => void;
}

// MiniGameButton types
export interface MiniGameButtonTheme {
  cornerRadius?: number;
  backgroundColor?: string;
  textColor?: string;
  fontSize?: number;
  padding?: string | number;
  borderWidth?: number;
  borderColor?: string;
  /** Pulsate glow color. Defaults to backgroundColor. */
  pulsateColor?: string;
  /** Badge dot color. Defaults to '#EF4444'. */
  badgeColor?: string;
}

export interface MiniGameButtonProps {
  text?: string;
  showPulsate?: boolean;
  showBadge?: boolean;
  theme?: MiniGameButtonTheme;
  /**
   * Component width. Supports multiple formats:
   * - number < 1: percentage as decimal (e.g., 0.8 = 80%)
   * - number >= 1: pixels (e.g., 500 = 500px)
   * - string with %: percentage (e.g., "80%" = 80%)
   * - string with number: pixels (e.g., "500" = 500px)
   * - null/undefined: content-sized (inline-flex)
   */
  width?: number | string | null;
  onClick: () => void;
}

// MiniGameInterstitial types
export interface MiniGameInterstitialTheme {
  ctaCornerRadius?: number;
  characterSize?: number;
  titleTextColor?: string;
  titleFontSize?: number;
  ctaTextColor?: string;
  ctaFontSize?: number;
  ctaColor?: string;
  fontFamily?: string;
}

export interface MiniGameInterstitialProps {
  charImage: string;
  invitationText?: string;
  ctaText?: string;
  backgroundImage?: string;
  theme?: MiniGameInterstitialTheme;
  isOpen: boolean;
  /** CTA button click handler. */
  onClick: () => void;
  /** Optional callback when the interstitial is dismissed (close button or ESC). Not called on CTA/backdrop click — use onClick for that. */
  onClose?: () => void;
}

// NativeBanner types
export interface NativeContext {
  searchTerm?: string;
  tags?: string[];
  category?: string;
  title?: string;
  description?: string;
  userProfile?: string;
  /** User email (requires privacy consent) */
  userEmail?: string;
  /** NSFW content flag */
  nsfw?: boolean;
  customContext?: Record<string, string | string[]>;
}

/**
 * Filter NativeContext for privacy - removes PII fields when consent is not granted.
 * When hasPrivacyConsent is false, removes userEmail and userProfile.
 */
export const filterContextForPrivacy = (context: NativeContext, hasPrivacyConsent: boolean): NativeContext => {
  if (hasPrivacyConsent) {
    return context;
  }
  // Return a copy without userEmail and userProfile
  const { userEmail, userProfile, ...filtered } = context;
  return filtered;
};

export interface NativeBannerProps {
  slot: string; // Placement identifier (e.g., 'feed', 'explore')
  /**
   * Ad width. Supports multiple formats:
   * - number < 1: percentage as decimal (e.g., 0.8 = 80%)
   * - number >= 1: pixels (e.g., 500 = 500px)
   * - string with %: percentage (e.g., "10%" = 10%)
   * - string with number: pixels (e.g., "500" = 500px)
   * - "auto" or null: fills container width (min 130px)
   */
  width?: number | string | null;
  position: number;
  context: NativeContext;
  /**
   * Custom loading component to display while the ad is loading.
   * - undefined: uses the default RadialLinesSpinner
   * - null: disables the loading indicator entirely
   * - React.ComponentType: renders your custom component
   */
  loadingComponent?: React.ComponentType | null;
  /** Called when the ad content has finished loading and is ready to display */
  onLoad?: (ad: AdData) => void;
  /** Called when the ad has been viewable for 1 second (MRC standard) */
  onImpression?: (ad: AdData) => void;
  /** Called when an error occurs fetching or loading the ad */
  onError?: (error: Error) => void;
}