export type AccentOption = 'blue' | 'red' | 'green' | 'yellow' | 'purple' | 'pink' | 'orange' | 'neutral' | 'gray' | 'tan' | 'transparent' | 'image';
export type FontOption = 'san-serif' | 'serif' | 'monospace';

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
}

export interface InChatAdSlotProps {
  messages: Message[];
  trigger?: Promise<any>;
  formats?: string | string[]; // Deprecated: ignored. Kept for backward compatibility.
  theme?: InChatTheme;
  debounceMs?: number;
  charDesc?: string;
  onImpression?: (ad: AdData) => void;
  onClick?: (ad: AdData) => void;
  onError?: (error: Error) => void;
}

export interface SimulaProviderProps {
  apiKey: string;
  children: React.ReactNode;
  devMode?: boolean;
  primaryUserID?: string;
}

export interface SimulaContextValue {
  apiKey: string;
  devMode: boolean;
  sessionId?: string;
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

// SponsoredSuggestions types
export interface SponsoredSuggestionsTheme {
  mode?: 'light' | 'dark' | 'auto';
  theme?: 'light' | 'dark' | 'auto'; // Deprecated: use 'mode' instead. Kept for backward compatibility.
  accent?: AccentOption | AccentOption[];
  font?: FontOption | FontOption[];
  width?: number | string;
  height?: number | string; // Configurable height (unlike InChatAdSlot which has fixed height)
  cornerRadius?: number;
}

export interface SponsoredSuggestionData {
  id: string;
  title: string;
  description: string;
  iframeUrl: string;
  imageUrl?: string;
}

export interface SponsoredSuggestionsProps {
  theme?: SponsoredSuggestionsTheme;
  onSuggestionClick?: (suggestion: SponsoredSuggestionData) => void;
  onImpression?: (suggestion: SponsoredSuggestionData) => void;
}