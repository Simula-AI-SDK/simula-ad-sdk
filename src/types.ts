export interface SimulaTheme {
  primary?: string;
  secondary?: string;
  border?: string;
  background?: string;
  width?: number | "auto";
  mobileWidth?: number;
  minWidth?: number;
  mobileBreakpoint?: number;
}

export interface Message {
  role: string;
  content: string;
}

export interface AdData {
  id: string;
  content: string;
  format: string;
  clickUrl?: string;
  impressionUrl?: string;
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