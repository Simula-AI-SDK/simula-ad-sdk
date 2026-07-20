import { useState, useEffect } from 'react';
import { load } from '@fingerprintjs/botd';
import { BotDetectionResult } from '../types';
import { logger } from '../utils/logger';

// Module-level shared detection promise — BotD runs ONCE per page no matter
// how many ad surfaces mount (previously every component instance called
// load() independently). Fails open: a detection failure assumes human.
let sharedDetection: Promise<BotDetectionResult> | null = null;

function detectOnce(): Promise<BotDetectionResult> {
  if (!sharedDetection) {
    sharedDetection = (async (): Promise<BotDetectionResult> => {
      try {
        const botd = await load();
        const detectionResult = await botd.detect();
        const isBot = detectionResult.bot;
        return {
          isBot,
          reasons: isBot ? ['FingerprintJS BotD detected automation'] : [],
        };
      } catch (error) {
        // If BotD fails to load, assume human user (fail open for better UX)
        logger.debug('BotD detection failed, assuming human user:', error);
        return {
          isBot: false,
          reasons: ['BotD failed to load - assuming human'],
        };
      }
    })();
  }
  return sharedDetection;
}

export const useBotDetection = (): BotDetectionResult => {
  const [result, setResult] = useState<BotDetectionResult>({
    isBot: false,
    reasons: []
  });

  useEffect(() => {
    let cancelled = false;
    detectOnce().then((detection) => {
      if (!cancelled) setResult(detection);
    });
    return () => { cancelled = true; };
  }, []);

  return result;
};
