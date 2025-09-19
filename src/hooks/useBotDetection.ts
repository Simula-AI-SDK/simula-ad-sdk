import { useState, useEffect } from 'react';
import { load } from '@fingerprintjs/botd';
import { BotDetectionResult } from '../types';

export const useBotDetection = (): BotDetectionResult => {
  const [result, setResult] = useState<BotDetectionResult>({
    isBot: false,
    reasons: []
  });

  useEffect(() => {
    const detectBot = async () => {
      try {
        // Load and use FingerprintJS BotD
        const botd = await load();
        const detectionResult = await botd.detect();
        
        const isBot = detectionResult.bot;
        const reasons = isBot ? ['FingerprintJS BotD detected automation'] : [];

        setResult({
          isBot,
          reasons
        });
      } catch (error) {
        // If BotD fails to load, assume human user (fail open for better UX)
        console.warn('BotD detection failed, assuming human user:', error);
        
        setResult({
          isBot: false,
          reasons: ['BotD failed to load - assuming human']
        });
      }
    };

    // Small delay to ensure DOM is ready
    const timer = setTimeout(detectBot, 100);
    return () => clearTimeout(timer);
  }, []);

  return result;
}; 