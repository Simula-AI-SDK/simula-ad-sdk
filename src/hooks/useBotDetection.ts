import { useState, useEffect } from 'react';
import { BotDetectionResult } from '../types';
import { logger } from '../utils/logger';

/**
 * Best-effort automation/bot detection — zero-dependency heuristics.
 *
 * Replaces the former `@fingerprintjs/botd` dependency (the SDK ships zero
 * third-party runtime dependencies — company priority). Only *obvious*
 * automation is flagged: the standard `navigator.webdriver` bit, headless /
 * automation-framework UA markers, automation-injected window globals, and
 * known crawler signatures.
 *
 * FAIL OPEN by design: any heuristic failure assumes human, so a false
 * positive can never hide an ad surface. Note the native SDKs (Kotlin/Swift)
 * ship no bot detection at all — this is a web-only extra.
 */

const HEADLESS_UA_MARKERS = [
  'HeadlessChrome',
  'PhantomJS',
  'SlimerJS',
  'Puppeteer',
  'Playwright',
  'Selenium',
  'Nightmare',
  'jsdom',
];

const CRAWLER_UA_MARKERS = [
  'Googlebot',
  'Bingbot',
  'Slurp', // Yahoo
  'DuckDuckBot',
  'Baiduspider',
  'YandexBot',
  'facebookexternalhit',
  'Twitterbot',
  'LinkedInBot',
  'Applebot',
  'GPTBot',
  'ClaudeBot',
  'CCBot',
  'Bytespider',
  'curl',
  'wget',
  'python-requests',
];

const AUTOMATION_WINDOW_GLOBALS = [
  '__nightmare',
  '_phantom',
  'callPhantom',
  'domAutomation',
  'domAutomationController',
  '__selenium_unwrapped',
  '__webdriver_evaluate',
  '__driver_evaluate',
  '$cdc_asdjflasutopfhvcZLmcfl_',
  '$chrome_asyncScriptInfo',
  '__fxdriver_evaluate',
];

/** Pure detection over injectable signals — exported for tests. */
export function detectBotSignals(signals: {
  userAgent: string;
  webdriver: boolean;
  languages?: readonly string[];
  windowGlobals: string[];
}): BotDetectionResult {
  const reasons: string[] = [];

  if (signals.webdriver) {
    reasons.push('navigator.webdriver is true');
  }

  const ua = signals.userAgent || '';
  for (const marker of HEADLESS_UA_MARKERS) {
    if (ua.includes(marker)) {
      reasons.push(`headless UA marker: ${marker}`);
      break;
    }
  }
  for (const marker of CRAWLER_UA_MARKERS) {
    if (ua.toLowerCase().includes(marker.toLowerCase())) {
      reasons.push(`crawler UA marker: ${marker}`);
      break;
    }
  }

  for (const globalName of AUTOMATION_WINDOW_GLOBALS) {
    if (signals.windowGlobals.includes(globalName)) {
      reasons.push(`automation window global: ${globalName}`);
      break;
    }
  }

  // A modern browser with no languages at all is near-certainly automated
  if (Array.isArray(signals.languages) && signals.languages.length === 0 && !ua.includes('Facebook')) {
    reasons.push('navigator.languages is empty');
  }

  return { isBot: reasons.length > 0, reasons };
}

let cachedResult: BotDetectionResult | null = null;

/** Runs the detection ONCE per page (module-level memo — previously BotD loaded per component). */
function detectOnce(): BotDetectionResult {
  if (cachedResult) return cachedResult;
  try {
    if (typeof navigator === 'undefined' || typeof window === 'undefined') {
      cachedResult = { isBot: false, reasons: [] };
      return cachedResult;
    }
    const windowGlobals = AUTOMATION_WINDOW_GLOBALS.filter((name) => name in window || name in (globalThis as any));
    cachedResult = detectBotSignals({
      userAgent: navigator.userAgent ?? '',
      webdriver: navigator.webdriver === true,
      languages: navigator.languages,
      windowGlobals,
    });
    if (cachedResult.isBot) {
      logger.debug('Bot detection flagged automation:', cachedResult.reasons);
    }
    return cachedResult;
  } catch (error) {
    // Fail open: any detector failure assumes human
    logger.debug('Bot detection failed, assuming human user:', error);
    cachedResult = { isBot: false, reasons: ['detection failed - assuming human'] };
    return cachedResult;
  }
}

export const useBotDetection = (): BotDetectionResult => {
  const [result, setResult] = useState<BotDetectionResult>(() => detectOnce());

  useEffect(() => {
    // Detection is synchronous — but run again post-mount in case the
    // component rendered during an odd environment (SSR/hydration mismatch)
    const detected = detectOnce();
    if (detected.isBot !== result.isBot) {
      setResult(detected);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return result;
};

/** Test hook. Not public API. */
export function _resetBotDetectionForTests(): void {
  cachedResult = null;
}
