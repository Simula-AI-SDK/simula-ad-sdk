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

  /*  Aditude Config */
  aditudeReady: boolean;
  aditudeConfig: AditudeConfig | undefined;
}

export interface FetchAdRequest {
  messages: Message[];
  apiKey: string;
  slotId?: string;
  theme?: InChatTheme;
  sessionId?: string;
  charDesc?: string;
}

export interface FetchAdResponse {
  ad?: AdData;
  error?: string;
}

export interface CatalogResponse {
  menuId: string;
  games: GameData[];
}

export interface InitMinigameRequest {
  gameType: string;
  sessionId: string;
  convId?: string | null;
  entryPoint?: string;
  currencyMode?: boolean;
  w: number;
  h: number;
  char_id?: string;
  char_name?: string;
  char_image?: string;
  char_desc?: string;
  messages?: Message[];
  delegate_char?: boolean;
  menuId?: string;
}

export interface MinigameResponse {
  adType: 'minigame';
  adInserted: boolean;
  adResponse: {
    ad_id: string;
    serve_id?: string;
    iframe_url: string;
  };
}

export interface AditudeSlotMapping {
  div_id: string;
  devices: string[];
  ad_unit_path: string;
  sizes: Record<string, number[][]>;
}

export interface AditudeConfig {
  domain: string;
  enabled: boolean;
  script_url: string;
  mappings: AditudeSlotMapping[];
}

export interface FetchNativeBannerRequest {
  sessionId: string;
  slot: string;
  position: number;
  context: NativeContext;
  width?: number;
}

export interface FetchNativeAdResponse {
  ad?: AdData;
  error?: string;
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
   * Minimum game content height is 500px (handle and banner are added on top).
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
  gifCover?: string; // GIF cover image URL for card display
}

/**
 * Internal-only preloaded entry hook used by the imperative interstitial path
 * to open MiniGameMenu directly into a preselected sponsored game without
 * mounting the grid UI or firing a menu-click beacon.
 *
 * NOT part of the public declarative API — treat this as an internal contract
 * between `SimulaMiniGameInterstitial` and `MiniGameMenu`.
 *
 * @internal
 */
export interface MiniGameMenuPreloadedEntry {
  /** Sponsored game id to open immediately. */
  gameId: string;
  /** Sponsored game name (used for onGameOpen / onGameClose callbacks). */
  gameName: string;
  /** Sponsored game description (used for onGameOpen callback). */
  gameDescription: string;
  /** Pre-fetched catalog so the menu can skip its own fetchCatalog. Optional. */
  games?: GameData[];
  /** Pre-fetched menu id (if any). Optional. */
  menuId?: string | null;
  /**
   * Pre-fetched minigame bootstrap. When present, the underlying GameIframe
   * skips its own getMinigame() call and renders from this payload directly.
   */
  preloadedMinigame?: MinigameResponse;
  /**
   * Pre-fetched fallback-ad iframe URL for the post-game ad slot. `null` /
   * `undefined` means nothing prefetched; the component will fall back to
   * its existing network behavior.
   */
  preloadedFallbackAdUrl?: string | null;
}

export interface MiniGameMenuProps {
  isOpen: boolean;
  onClose: () => void;
  charName: string;
  charID: string;
  charImage: string;
  messages?: Message[];
  charDesc?: string;
  /** Conversation ID for tracking which conversation triggered the minigame. */
  convId?: string;
  /** Entry point describing how the user reached the minigame (e.g., 'button', 'invitation', 'interstitial'). */
  entryPoint?: string;
  maxGamesToShow?: 3 | 6 | 9;
  theme?: MiniGameTheme;
  delegateChar?: boolean; // Whether Simula should display the AI character within the iframe (default: true)
  /** Navigation style for the game grid. Default: 'dot'. */
  navigationType?: MiniGameNavigationType;
  /** Called when a game is opened (user selects a game from the menu). Receives the game name and description. */
  onGameOpen?: (gameName: string, gameDescription: string) => void;
  /** Called when the game closes (game iframe closed, and ad iframe closed if applicable). Receives the game name. */
  onGameClose?: (gameName: string) => void;
  /** Whether to show a banner ad at the top of the minigame iframe. Default: true */
  showBanner?: boolean;
  /**
   * Internal-only. When provided, MiniGameMenu opens directly into the given
   * sponsored game without rendering the selection grid, does NOT fire
   * `trackMenuGameClick`, and forwards the preloaded minigame bootstrap /
   * fallback-ad URL to the child components. Set by the imperative
   * interstitial manager; public declarative callers should leave it
   * undefined.
   * @internal
   */
  _preloadedEntry?: MiniGameMenuPreloadedEntry;
}

export type MiniGameNavigationType = 'dot' | 'arrow' | 'pagination';

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
   * Maximum component width. Supports multiple formats:
   * - number < 1: percentage as decimal (e.g., 0.8 = 80%)
   * - number >= 1: pixels (e.g., 500 = 500px)
   * - string with %: percentage (e.g., "80%" = 80%)
   * - string with number: pixels (e.g., "500" = 500px)
   * - null/undefined: no max width constraint
   */
  maxWidth?: number | string | null;
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
  fontFamily?: string;
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

// RewardedMiniGame types
export interface InitRewardedResponse {
  id: string;
  name: string;
  iconUrl: string;
  description: string;
  gifCover?: string;
  serve_id: string;
  iframe_url: string;
  duration_seconds: number;
  ad_id: string | null;
}

export interface VerifyRewardResponse {
  verified: boolean;
  token: string;
}

export interface RewardedMiniGameProps {
  isOpen: boolean;
  charName: string;
  charID: string;
  charImage: string;
  charDesc?: string;
  /** Minimum play seconds required before close button appears. Clamped to [10, 30]. Default: 15 */
  minPlayThreshold?: number;
  /** Called when SSV verification succeeds. Grant reward here. */
  onRewardVerified: () => void;
  /** Called when SSV verification fails after retry. */
  onRewardVerificationFailed?: () => void;
  /** Conversation history passed through to post-game MiniGameMenu. */
  messages?: Message[];
  /**
   * Internal-only. Pre-fetched rewarded bootstrap. When present, the
   * component skips its own initRewardedGame() call and enters the 'playing'
   * phase directly from this payload. Set by SimulaRewardedMiniGame after
   * `.load()` preload settles.
   * @internal
   */
  _preloadedRewarded?: InitRewardedResponse;
  /**
   * Internal-only. Pre-fetched fallback-ad iframe URL for the post-game ad
   * slot. Skips the fetchAdForMinigame() call during the 'ad' phase when set.
   * @internal
   */
  _preloadedFallbackAdUrl?: string | null;
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
