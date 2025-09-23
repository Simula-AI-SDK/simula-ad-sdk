export interface SimulaTheme {
  theme?: 'light' | 'dark' | 'auto';
  accent?: 'blue' | 'red' | 'green' | 'yellow' | 'purple' | 'pink' | 'orange' | 'neutral' | 'gray' | 'tan';
  font?: 'san-serif' | 'serif' | 'monospace';
  width?: number | "auto";
  mobileWidth?: number;
  minWidth?: number;
  mobileBreakpoint?: number;
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

export interface AdSlotProps {
  messages: Message[];
  trigger: Promise<any>;
  formats?: string[];
  theme?: SimulaTheme;
  slotId?: string;
  debounceMs?: number;
  minIntervalMs?: number;
  onlyWhenVisible?: boolean;
  onImpression?: (ad: AdData) => void;
  onClick?: (ad: AdData) => void;
  onError?: (error: Error) => void;
}

export interface SimulaProviderProps {
  apiKey?: string;
  children: React.ReactNode;
  devMode?: boolean;
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
  onImpressionTracked?: (adId: string) => void;
}

export interface ViewabilityResult {
  isViewable: boolean;
  hasBeenViewed: boolean;
  impressionTracked: boolean;
}