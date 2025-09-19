export interface SimulaTheme {
  primary?: string;
  secondary?: string;
  border?: string;
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
  apiKey: string;
  children: React.ReactNode;
}

export interface SimulaContextValue {
  apiKey: string;
}

export interface BotDetectionResult {
  isBot: boolean;
  reasons: string[];
}