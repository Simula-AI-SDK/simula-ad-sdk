import { describe, it, expect } from 'vitest';
import {
  parseAdBehavior,
  parseCloseBehavior,
  validatedHexColor,
  closeTreatmentFrom,
  closePositionFrom,
  storeOpenFrom,
  adUnitTypeFrom,
  MAX_CLOSE_DELAY_SECONDS,
} from '../adBehavior';

describe('ad_behavior parser (native parity)', () => {
  it('normalizes tokens (case + dashes)', () => {
    expect(closeTreatmentFrom('Countdown-Circle')).toBe('countdown_circle');
    expect(closeTreatmentFrom('PROGRESS_BAR')).toBe('progress_bar');
    expect(closePositionFrom('Top-Left')).toBe('top_left');
  });

  it('unknown/missing values fall to the safest defaults', () => {
    expect(closeTreatmentFrom('bogus')).toBe('hidden');
    expect(closeTreatmentFrom(null)).toBe('hidden');
    expect(closePositionFrom('bottom_right')).toBe('top_right'); // excluded corner
    expect(closePositionFrom(undefined)).toBe('top_right');
    expect(storeOpenFrom('external_browser')).toBe('external'); // legacy alias
    expect(storeOpenFrom('sk_overlay')).toBe('skstoreproduct');
    expect(adUnitTypeFrom('bogus')).toBe('interstitial');
    expect(adUnitTypeFrom('rewarded')).toBe('rewarded');
  });

  it('clamps the close delay to [0, 45]', () => {
    expect(parseCloseBehavior({ delay_seconds: 120 }).delaySeconds).toBe(MAX_CLOSE_DELAY_SECONDS);
    expect(parseCloseBehavior({ delay_seconds: -5 }).delaySeconds).toBe(0);
    expect(parseCloseBehavior({ delay_seconds: 30 }).delaySeconds).toBe(30);
    expect(parseCloseBehavior({ delay_seconds: NaN }).delaySeconds).toBe(0);
    expect(parseCloseBehavior(null).delaySeconds).toBe(0);
  });

  it('validates hex colors (6-digit, optional #, else white)', () => {
    expect(validatedHexColor('#ff00aa')).toBe('#FF00AA');
    expect(validatedHexColor('00ff00')).toBe('#00FF00');
    expect(validatedHexColor('#fff')).toBe('#FFFFFF');
    expect(validatedHexColor('red')).toBe('#FFFFFF');
    expect(validatedHexColor(null)).toBe('#FFFFFF');
    expect(validatedHexColor('#12345g')).toBe('#FFFFFF');
  });

  it('parses a full ad_behavior payload', () => {
    const behavior = parseAdBehavior({
      close: { delay_seconds: 20, treatment: 'countdown_circle', position: 'top_left', progress_bar_color: '#ff0000' },
      store_open: 'external',
      auto_store_redirect: { enabled: true, trigger: 'end_screen_1_open' },
    });
    expect(behavior).toEqual({
      close: { delaySeconds: 20, treatment: 'countdown_circle', position: 'top_left', progressBarColor: '#FF0000' },
      storeOpen: 'external',
      autoStoreRedirect: { enabled: true, trigger: 'end_screen_1_open' },
    });
  });

  it('an absent ad_behavior node stays null (callers keep defaults)', () => {
    expect(parseAdBehavior(null)).toBeNull();
    expect(parseAdBehavior(undefined)).toBeNull();
    expect(parseAdBehavior('junk')).toBeNull();
  });
});
