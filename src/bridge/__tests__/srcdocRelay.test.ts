import { describe, it, expect } from 'vitest';
import { injectSrcdocRelay, hasBridgeRelay } from '../srcdocRelay';

describe('injectSrcdocRelay', () => {
  it('injects before </body> when present', () => {
    const out = injectSrcdocRelay('<html><body><div>ad</div></body></html>');
    expect(out.startsWith('<html><body><div>ad</div><script data-simula-relay="1">')).toBe(true);
    expect(out.endsWith('</script></body></html>')).toBe(true);
    expect(out).toContain('SIMULA_AD_SIZE');
  });

  it('appends at the end when no </body>', () => {
    const out = injectSrcdocRelay('<div>ad</div>');
    expect(out.startsWith('<div>ad</div>')).toBe(true);
    expect(out).toContain('data-simula-relay');
  });

  it('is idempotent (never double-injects)', () => {
    const once = injectSrcdocRelay('<div>ad</div>');
    expect(injectSrcdocRelay(once)).toBe(once);
  });

  it('leaves backend bridge-aware templates untouched', () => {
    const backendRelay = '<div>ad</div><script>send("SIMULA_AD_SIZE", {})</script>';
    expect(injectSrcdocRelay(backendRelay)).toBe(backendRelay);
    const backendCta = '<div>ad</div><script>send("CTA_CLICK", {})</script>';
    expect(injectSrcdocRelay(backendCta)).toBe(backendCta);
  });

  it('handles empty input safely', () => {
    expect(injectSrcdocRelay('')).toBe('');
  });

  it('the relay reports height and forwards CTA taps', () => {
    const out = injectSrcdocRelay('<div>ad</div>');
    expect(out).toContain('SIMULA_AD_SIZE');
    expect(out).toContain('CTA_CLICK');
    expect(out).toContain('scrollHeight');
    expect(out).toContain('ResizeObserver');
  });

  it('hasBridgeRelay detects contract-carrying HTML', () => {
    expect(hasBridgeRelay('<div>plain</div>')).toBe(false);
    expect(hasBridgeRelay(injectSrcdocRelay('<div>ad</div>'))).toBe(true);
  });
});
