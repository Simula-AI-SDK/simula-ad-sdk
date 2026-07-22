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

  it('injects into templates that report CTA_CLICK but NOT height (character_ad.html case)', () => {
    const backendCtaOnly = '<div>ad</div><script>window.parent.postMessage({type:"CTA_CLICK",payload:{handled:true}},"*")</script>';
    const out = injectSrcdocRelay(backendCtaOnly);
    expect(out).not.toBe(backendCtaOnly);
    expect(out).toContain('SIMULA_AD_SIZE'); // sizing added
  });

  it('leaves backend height-aware templates untouched', () => {
    const backendRelay = '<div>ad</div><script>send("SIMULA_AD_SIZE", {})</script>';
    expect(injectSrcdocRelay(backendRelay)).toBe(backendRelay);
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

describe('injectSrcdocRelay — nested srcdoc creatives (backend wrapper templates)', () => {
  /** Mirrors the real character_ad payload: wrapper doc + inner card in an
   * escaped srcdoc iframe, self-sized via (sandbox-dead) contentDocument. */
  const INNER =
    '<!DOCTYPE html><html><head><style>html,body{height:100%;overflow:hidden}</style></head>' +
    '<body><div class="media">card</div></body></html>';
  const escapeAttr = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const OUTER =
    '<!DOCTYPE html><html><head></head><body>' +
    `<iframe srcdoc="${escapeAttr(INNER)}" style="width:100%" ` +
    `onload="this.style.height=this.contentDocument.body.scrollHeight+'px';"></iframe>` +
    '</body></html>';

  it('injects the relay into BOTH the wrapper and the (escaped) inner document', () => {
    const out = injectSrcdocRelay(OUTER);
    // Outer level: raw relay before the real </body>
    expect(out).toContain('<script data-simula-relay="1">');
    expect(out.toLowerCase().lastIndexOf('</body>')).toBeGreaterThan(out.indexOf('data-simula-relay'));
    // Inner level: relay present in ESCAPED form inside the srcdoc attribute
    expect(out).toContain('&lt;script data-simula-relay=&quot;1&quot;&gt;');
  });

  it('round-trips the inner document content losslessly', () => {
    const out = injectSrcdocRelay(OUTER);
    expect(out).toContain(escapeAttr('<div class="media">card</div>'));
    expect(out).toContain('this.contentDocument.body.scrollHeight'); // outer attrs untouched
  });

  it('is idempotent on nested creatives', () => {
    const once = injectSrcdocRelay(OUTER);
    expect(injectSrcdocRelay(once)).toBe(once);
  });

  it('a bridge-aware INNER does not suppress the wrapper relay (forwarder still needed)', () => {
    const bridgeAwareInner = INNER.replace(
      '</body>',
      '<script>window.parent.postMessage({type:"SIMULA_AD_SIZE",payload:{height:1}},"*")</script></body>',
    );
    const outer = OUTER.replace(escapeAttr(INNER), escapeAttr(bridgeAwareInner));
    const out = injectSrcdocRelay(outer);
    // Outer gets the relay (it must forward/resize) …
    expect(out).toContain('<script data-simula-relay="1">');
    // … but the already-aware inner is left untouched (no injected marker inside)
    expect(out).not.toContain('&lt;script data-simula-relay=');
  });

  it('the relay bridges across levels: child sizing, upward forwarding, downward replies', () => {
    const out = injectSrcdocRelay(OUTER);
    expect(out).toContain("from.style.height = Math.ceil(hh) + 'px'");
    expect(out).toContain('__simulaSdkResponse');
    expect(out).toContain("window.parent.postMessage(d, '*')");
  });

  it('reports pointer-cursor click-throughs as handled CTA clicks', () => {
    const out = injectSrcdocRelay('<div>ad</div>');
    expect(out).toContain("cursor === 'pointer'");
    expect(out).toContain('handled: true');
  });
});
