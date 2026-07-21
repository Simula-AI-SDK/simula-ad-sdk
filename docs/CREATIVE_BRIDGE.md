# Creative Bridge Contract (Web SDK ↔ Ad Creatives)

The web SDK (`@simula/ads` ≥ 2.0) isolates ad creatives in sandboxed iframes.
**`srcdoc` creatives run with an opaque origin** — they cannot touch the host
page's DOM, cookies, or storage. Everything a creative needs flows over this
`window.postMessage` contract.

**Backend requirement:** native/interstitial creative templates MUST include a
small relay script implementing the messages below. Without it:

- native ads render stuck at the 250px default height (no `SIMULA_AD_SIZE`)
- CTA taps navigate (via `allow-popups`) but never fire `onClick` / click
  telemetry (`CTA_CLICK`) — a silent revenue-tracking hole

## Envelope

Creative → SDK: `{ "type": string, "requestId"?: any, "payload"?: object }`
posted via `window.parent.postMessage(msg, '*')`.

SDK → creative: `{ "type", "requestId", "payload", "__simulaSdkResponse": true }`
— the relay MUST ignore messages carrying `__simulaSdkResponse: true` (echoes).

## Creative → SDK messages

| `type` | `payload` | SDK behavior |
|---|---|---|
| `SIMULA_AD_SIZE` | `{ "height": number }` | Resizes the native ad iframe (px). Fire on load and on every content height change. |
| `CTA_CLICK` | `{ "url"?: string }` | Fires `onClick`/`CLICKED` + click telemetry, then opens `url` (or the serve's `tracking_url` fallback) in a new tab. |
| `AD_EARLY_COMPLETE` | — | Closes the fullscreen ad immediately (playables that finish early). |
| `CREATIVE_MOMENT` | `{ "moment": string }` | Lifecycle moment, matched verbatim against `auto_store_redirect.trigger` (`playable_end`, `end_screen_1_open`, `end_screen_2_open`). |

## SDK → creative replies (queries)

| `type` | Reply `payload` |
|---|---|
| `GET_DEVICE_CONTEXT` | `{ platform: "web", language, timezone, connectionType, screen: {width,height}, viewport: {width,height} }` |
| `GET_AUDIO_STATE` | `{ muted: null, volume: null }` (browsers expose no system volume — explicit unknowns) |
| `GET_ORIENTATION` | `{ orientation: "portrait" \| "landscape" }` |

Echo the creative's `requestId` verbatim in replies.

## Minimal relay script (drop-in for templates)

```html
<script>
(function () {
  var parent = window.parent;
  function send(type, payload, requestId) {
    var msg = { type: type, payload: payload };
    if (requestId !== undefined) msg.requestId = requestId;
    parent.postMessage(msg, '*');
  }

  // Height reporting (native ads)
  function reportHeight() {
    send('SIMULA_AD_SIZE', { height: document.body.scrollHeight });
  }
  window.addEventListener('load', function () {
    reportHeight();
    if ('ResizeObserver' in window) new ResizeObserver(reportHeight).observe(document.body);
  });

  // CTA taps
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[data-simula-cta]');
    if (a) {
      e.preventDefault();
      send('CTA_CLICK', { url: a.href });
    }
  }, true);

  // Queries
  window.addEventListener('message', function (e) {
    var d = e.data;
    if (!d || d.__simulaSdkResponse === true) return;
    // (templates may also call GET_* proactively and read the echoed reply)
  });
})();
</script>
```

## Sandbox reference

| Creative source | `sandbox` attribute |
|---|---|
| `srcdoc` (rendered HTML) | `allow-scripts allow-popups allow-popups-to-escape-sandbox` (opaque origin) |
| `iframe_url` (remote) | `allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox` |
