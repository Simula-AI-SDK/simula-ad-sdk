/**
 * srcdoc relay injection — makes first-party srcdoc creatives bridge-aware
 * WITHOUT requiring backend template changes.
 *
 * srcdoc iframes run with an opaque origin (no allow-same-origin), so the
 * parent page cannot measure their content or see their clicks. This injects
 * a tiny, capability-free relay into the creative HTML before it is assigned
 * to the iframe: the relay posts `SIMULA_AD_SIZE` on load/resize (height
 * tracking) and forwards CTA taps as `CTA_CLICK` — the two signals the SDK
 * needs, over `postMessage`, which works across opaque origins.
 *
 * The injection is capability-neutral: it runs inside the same sandbox as the
 * creative's own scripts and can do nothing the creative couldn't already do.
 * Templates that already implement the bridge contract (backend-shipped
 * relay) are detected and left untouched.
 */

const RELAY_MARKER = 'data-simula-relay';

/** Strings indicating the template already implements the bridge contract. */
const CONTRACT_HINTS = ['SIMULA_AD_SIZE', 'CTA_CLICK', RELAY_MARKER];

const RELAY_SCRIPT = `<script ${RELAY_MARKER}="1">(function () {
  if (window.__simulaRelayInstalled) return;
  window.__simulaRelayInstalled = true;
  function send(type, payload) {
    try { window.parent.postMessage({ type: type, payload: payload }, '*'); } catch (e) {}
  }
  function contentHeight() {
    var h = 0;
    try {
      var de = document.documentElement;
      var b = document.body;
      h = Math.max(de ? de.scrollHeight : 0, b ? b.scrollHeight : 0);
      // Templates with html,body{height:100%;overflow:hidden} pin scrollHeight
      // to the iframe itself — walk the tree for the TRUE layout bottom
      // (getBoundingClientRect ignores overflow clipping).
      if (b) {
        var els = b.querySelectorAll('*');
        for (var i = 0; i < els.length; i++) {
          var bottom = els[i].getBoundingClientRect().bottom;
          if (bottom > h) h = bottom;
        }
      }
    } catch (e) {}
    return Math.ceil(h);
  }
  function reportHeight() {
    try {
      var h = contentHeight();
      if (h > 0) send('SIMULA_AD_SIZE', { height: h });
    } catch (e) {}
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', reportHeight);
  } else {
    reportHeight();
  }
  window.addEventListener('load', reportHeight);
  window.addEventListener('resize', reportHeight); // width-driven (aspect-ratio) creatives
  try {
    if (typeof ResizeObserver === 'function') {
      var ro = new ResizeObserver(reportHeight);
      ro.observe(document.documentElement);
      if (document.body) ro.observe(document.body);
    }
  } catch (e) {}
  // Late passes catch webfonts/images settling even without ResizeObserver
  setTimeout(reportHeight, 300);
  setTimeout(reportHeight, 1000);
  setTimeout(reportHeight, 2500);
  document.addEventListener('click', function (e) {
    try {
      var t = e.target;
      var el = t && t.closest ? t.closest('a[href],[data-simula-cta]') : null;
      if (!el) return;
      e.preventDefault();
      var url = el.getAttribute('href') || el.getAttribute('data-simula-cta-url') || undefined;
      send('CTA_CLICK', { url: url });
    } catch (err) {}
  }, true);
})();</script>`;

/**
 * Returns the creative HTML with the relay script appended (before `</body>`
 * when present, else at the end). Idempotent and contract-aware: HTML that
 * already carries a relay (ours or the backend's) is returned unchanged.
 */
export function injectSrcdocRelay(html: string): string {
  if (!html) return html;
  if (CONTRACT_HINTS.some((hint) => html.includes(hint))) return html;
  const bodyClose = html.toLowerCase().lastIndexOf('</body>');
  if (bodyClose >= 0) {
    return html.slice(0, bodyClose) + RELAY_SCRIPT + html.slice(bodyClose);
  }
  return html + RELAY_SCRIPT;
}

/** Test/diagnostics: does this HTML already carry a bridge implementation? */
export function hasBridgeRelay(html: string): boolean {
  return CONTRACT_HINTS.some((hint) => html.includes(hint));
}
