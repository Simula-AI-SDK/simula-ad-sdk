import { describe, it, expect } from 'vitest';
import { detectBotSignals } from '../useBotDetection';

const base = {
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  webdriver: false,
  languages: ['en-US', 'en'],
  windowGlobals: [] as string[],
};

describe('detectBotSignals (zero-dep heuristics, fail-open)', () => {
  it('a normal desktop browser is human', () => {
    expect(detectBotSignals(base).isBot).toBe(false);
  });

  it('navigator.webdriver=true is flagged', () => {
    const result = detectBotSignals({ ...base, webdriver: true });
    expect(result.isBot).toBe(true);
    expect(result.reasons[0]).toContain('webdriver');
  });

  it('headless UA markers are flagged', () => {
    expect(detectBotSignals({ ...base, userAgent: base.userAgent.replace('Chrome/', 'HeadlessChrome/') }).isBot).toBe(true);
    expect(detectBotSignals({ ...base, userAgent: 'Mozilla/5.0 PhantomJS/2.1' }).isBot).toBe(true);
    expect(detectBotSignals({ ...base, userAgent: 'Mozilla/5.0 jsdom/22.0' }).isBot).toBe(true);
  });

  it('crawler UAs are flagged (ad impressions must not fire for crawlers)', () => {
    expect(detectBotSignals({ ...base, userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' }).isBot).toBe(true);
    expect(detectBotSignals({ ...base, userAgent: 'curl/8.4.0' }).isBot).toBe(true);
    expect(detectBotSignals({ ...base, userAgent: 'python-requests/2.31.0' }).isBot).toBe(true);
  });

  it('automation window globals are flagged', () => {
    expect(detectBotSignals({ ...base, windowGlobals: ['__selenium_unwrapped'] }).isBot).toBe(true);
    expect(detectBotSignals({ ...base, windowGlobals: ['_phantom'] }).isBot).toBe(true);
  });

  it('empty languages is flagged (modern browsers always ship at least one)', () => {
    expect(detectBotSignals({ ...base, languages: [] }).isBot).toBe(true);
  });

  it('missing/odd inputs fail open (assume human)', () => {
    expect(detectBotSignals({ userAgent: '', webdriver: false, languages: undefined, windowGlobals: [] }).isBot).toBe(false);
  });
});
