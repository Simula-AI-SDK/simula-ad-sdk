export { SimulaProvider, useSimula } from './SimulaProvider';
export { AdSlot } from './AdSlot';
export { useBotDetection } from './hooks/useBotDetection';
export { useViewability } from './hooks/useViewability';
export { useOMIDViewability } from './hooks/useOMIDViewability';

// Test utilities
export { mockAds, getMockAd, getRandomMockAd, mockFetchAd, mockTrackImpression } from './test-data/mockAds';
export type {
  SimulaTheme,
  Message,
  AdData,
  AdSlotProps,
  SimulaProviderProps,
  SimulaContextValue,
  BotDetectionResult,
  ViewabilityOptions,
  ViewabilityResult,
  OMIDViewabilityOptions,
  OMIDViewabilityResult
} from './types';