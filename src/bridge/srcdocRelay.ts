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
 * NESTED CREATIVES: backend templates are often a thin wrapper document
 * holding the actual card in an inner `<iframe srcdoc="…">`, self-sized via
 * direct `contentDocument` access. Under the SDK sandbox every nesting level
 * is a DISTINCT opaque origin, so that access is dead (the inner iframe
 * would freeze at the 150px browser default). Injection therefore recurses
 * into nested srcdoc attributes, and the relay bridges levels over
 * postMessage: a child's `SIMULA_AD_SIZE` sizes the child's iframe locally
 * and re-reports the level's own height upward; other bridge messages are
 * forwarded up verbatim (the SDK only trusts the top-level creative window
 * as a source); SDK replies are rebroadcast down to children.
 *
 * The injection is capability-neutral: it runs inside the same sandbox as the
 * creative's own scripts and can do nothing the creative couldn't already do.
 * Templates that already implement the bridge contract (backend-shipped
 * relay) are detected and left untouched.
 */

const RELAY_MARKER = 'data-simula-relay';

/** srcdoc nesting levels to process (level 0 = the document itself). */
const MAX_NESTED_DEPTH = 3;

/**
 * Strings indicating the template ALREADY reports its height (the relay's
 * primary job). Note `CTA_CLICK` is deliberately NOT a skip hint: a template
 * can report clicks yet have no size reporting (e.g. character_ad.html) —
 * injecting the relay then adds sizing without duplicating anything (the
 * relay's click capture only fires for a[href]/[data-simula-cta] elements
 * and pointer-cursor click-throughs, which such templates don't use).
 */
const CONTRACT_HINTS = ['SIMULA_AD_SIZE', RELAY_MARKER];

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
  var lastSentHeight = 0;
  function reportHeight() {
    try {
      var h = contentHeight();
      if (h > 0 && h !== lastSentHeight) {
        lastSentHeight = h;
        send('SIMULA_AD_SIZE', { height: h });
      }
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
  // Cross-level bridge: each nested srcdoc level is a distinct opaque origin,
  // so a wrapper can no longer reach into its child directly. Size children
  // from their reports, pass everything else along the chain.
  window.addEventListener('message', function (e) {
    try {
      var d = e.data;
      if (!d || typeof d.type !== 'string') return;
      var frames = document.querySelectorAll('iframe');
      if (d.__simulaSdkResponse === true) {
        // SDK reply arriving from above — rebroadcast to children
        if (e.source === window.parent) {
          for (var i = 0; i < frames.length; i++) {
            try { frames[i].contentWindow.postMessage(d, '*'); } catch (err) {}
          }
        }
        return;
      }
      var from = null;
      for (var j = 0; j < frames.length; j++) {
        if (frames[j].contentWindow === e.source) { from = frames[j]; break; }
      }
      if (!from) return; // not from one of our children
      if (d.type === 'SIMULA_AD_SIZE') {
        var hh = d.payload && d.payload.height;
        // Child sizing is for CONTENT-SIZED wrappers only (native cards whose
        // inner iframe is stuck at the 150px default). Fullscreen wrappers pin
        // the child to the viewport (inline height:100% and/or a viewport-
        // locked body) — overriding that with the child's report creates an
        // unbounded grow loop: fixed px -> child viewport grows -> child
        // re-reports higher. Skip both pinned shapes.
        var inlinePinned = /height\\s*:\\s*[\\d.]+%/.test(from.getAttribute('style') || '');
        var viewportLocked = false;
        try { viewportLocked = getComputedStyle(document.body).overflow === 'hidden'; } catch (err) {}
        if (!inlinePinned && !viewportLocked && typeof hh === 'number' && hh > 0) {
          from.style.height = Math.ceil(hh) + 'px';
          reportHeight(); // our own content just grew/shrank — tell OUR parent
        }
        return;
      }
      // Forward the child's bridge message up verbatim (preserves requestId)
      try { window.parent.postMessage(d, '*'); } catch (err) {}
    } catch (err) {}
  });
  document.addEventListener('click', function (e) {
    try {
      var t = e.target;
      var el = t && t.closest ? t.closest('a[href],[data-simula-cta]') : null;
      if (el) {
        e.preventDefault();
        var url = el.getAttribute('href') || el.getAttribute('data-simula-cta-url') || undefined;
        send('CTA_CLICK', { url: url });
        return;
      }
      // Whole-card click-throughs (no anchor; JS navigation): the discriminator
      // is a pointer cursor on <body> — card templates make the ENTIRE surface
      // the CTA (document-level click handler), so any tap is a click-through.
      // Playables/games have a default body cursor; their pointer-cursor
      // buttons (mute, restart, dialogue options) are gameplay, not CTAs.
      // handled:true — the creative navigates itself, never open a second tab.
      var bodyIsCta = false;
      try { bodyIsCta = getComputedStyle(document.body).cursor === 'pointer'; } catch (err) {}
      if (bodyIsCta && t && t.nodeType === 1) {
        send('CTA_CLICK', { handled: true });
      }
    } catch (err) {}
  }, true);
})();</script>`;

// ── srcdoc attribute escaping (inverse pairs — order matters) ───────────────

function unescapeSrcdocAttr(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&'); // last — so &amp;lt; round-trips to &lt;, not <
}

function escapeSrcdocAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;') // first — everything below introduces entities
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const SRCDOC_ATTR_RE = /srcdoc\s*=\s*("([^"]*)"|'([^']*)')/gi;

/** The document's own markup with nested srcdoc payloads blanked — so hints
 * in an (escaped) inner document never suppress this level's injection. */
function stripNestedSrcdocs(html: string): string {
  return html.replace(SRCDOC_ATTR_RE, 'srcdoc=""');
}

/**
 * Returns the creative HTML with the relay script appended (before `</body>`
 * when present, else at the end), recursing into nested srcdoc iframes.
 * Idempotent and contract-aware PER LEVEL: a level that already reports its
 * height (`SIMULA_AD_SIZE`) or carries our relay marker is left unchanged.
 */
export function injectSrcdocRelay(html: string, depth = 0): string {
  if (!html || depth >= MAX_NESTED_DEPTH) return html;
  // Hint check scoped to THIS level: a bridge-aware level manages its own
  // children, so neither it nor its subtree is touched.
  if (CONTRACT_HINTS.some((hint) => stripNestedSrcdocs(html).includes(hint))) return html;

  // Recurse into nested srcdoc documents first (unescape → inject → re-escape)
  const withNested = html.replace(SRCDOC_ATTR_RE, (_match, _quoted, dq, sq) => {
    const inner = unescapeSrcdocAttr(dq ?? sq ?? '');
    const injected = injectSrcdocRelay(inner, depth + 1);
    return `srcdoc="${escapeSrcdocAttr(injected)}"`;
  });

  const bodyClose = withNested.toLowerCase().lastIndexOf('</body>');
  if (bodyClose >= 0) {
    return withNested.slice(0, bodyClose) + RELAY_SCRIPT + withNested.slice(bodyClose);
  }
  return withNested + RELAY_SCRIPT;
}

/** Test/diagnostics: does this HTML already report its height / carry a relay? */
export function hasBridgeRelay(html: string): boolean {
  return CONTRACT_HINTS.some((hint) => html.includes(hint));
}
