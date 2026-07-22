/** Native ad theme (native parity: NativeAdSlot's `theme` param). */
export type SimulaNativeAdTheme = 'dark' | 'light' | 'system';

/**
 * Resolves the client-side theme to the wire value ("light" | "dark").
 * `system` (and only `system`) reads the OS preference; null/undefined
 * returns undefined so the key is omitted (backend defaults to light).
 */
export function resolveNativeAdTheme(theme?: string | null): 'light' | 'dark' | undefined {
  if (theme === 'dark' || theme === 'light') return theme;
  if (theme === 'system') {
    try {
      if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
    } catch {
      // fall through
    }
  }
  return undefined;
}
