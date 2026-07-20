import { describe, it, expect } from 'vitest';
import { resolveNativeAdTheme } from '../theme';

describe('resolveNativeAdTheme (native parity)', () => {
  it('passes through explicit themes', () => {
    expect(resolveNativeAdTheme('dark')).toBe('dark');
    expect(resolveNativeAdTheme('light')).toBe('light');
  });

  it('omits the key for null/unknown (backend defaults to light)', () => {
    expect(resolveNativeAdTheme(null)).toBeUndefined();
    expect(resolveNativeAdTheme(undefined)).toBeUndefined();
    expect(resolveNativeAdTheme('bogus')).toBeUndefined();
  });

  it('system resolves without throwing when matchMedia is unavailable', () => {
    // Node env: no window → undefined (documented fallback)
    expect(['light', 'dark', undefined]).toContain(resolveNativeAdTheme('system'));
  });
});
