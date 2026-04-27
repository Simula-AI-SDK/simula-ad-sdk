let debugEnabled = false;

export function setDebugMode(enabled: boolean): void {
  debugEnabled = enabled;
}

export const logger = {
  warn(...args: unknown[]): void {
    console.warn('[Simula]', ...args);
  },
  error(...args: unknown[]): void {
    console.error('[Simula]', ...args);
  },
  debug(...args: unknown[]): void {
    if (!debugEnabled) return;
    console.info('[Simula:debug]', ...args);
  },
};
