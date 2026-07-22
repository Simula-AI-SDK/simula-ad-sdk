# Simula Ad SDK (Web / React)

Monetize conversational AI and feed surfaces with contextually relevant ads. Feature-parity with the Simula native SDKs (Kotlin / Swift): same event names, error codes, wire contracts, and privacy framework.

- **Zero third-party runtime dependencies** — peer deps are `react` / `react-dom` only
- **Never crashes the host page** — every API degrades to a safe default instead of throwing
- **Privacy-first** — IAB TCF v2.2 / CCPA / GPP / COPPA consent framework with CMP auto-read
- **Durable by default** — beacons, reward verification, and telemetry survive offline tabs and page reloads

## Installation

```bash
npm install @simula/ads
```

## Quick start

### 1. Initialize

**Declarative (provider):**

```tsx
import { SimulaProvider } from "@simula/ads";

<SimulaProvider
  apiKey="SIMULA_xxx"
  devMode={false}
  primaryUserID="user-123"            // optional
  privacy={{ tcString, gdprApplies }} // optional, granular consent
  telemetryEnabled={true}             // optional
>
  {/* your app */}
</SimulaProvider>
```

**Imperative (parity with the native `SimulaAds`):**

```ts
import { SimulaAds } from "@simula/ads";

SimulaAds.initialize({
  apiKey: "SIMULA_xxx",
  devMode: false,
  primaryUserID: "user-123",
  privacy: { tcString, gdprApplies: true, coppaApplies: false },
  telemetryEnabled: true,
  adContext: { searchTerm: "cooking", tags: ["food"] },
});
// first valid call wins — later calls are safe no-ops

SimulaAds.updateContext({ tags: ["news"] });
SimulaAds.updatePrimaryUserID("user-456"); // mid-session login
SimulaAds.updatePrimaryUserID(null);       // logout
const capped = await SimulaAds.checkFrequencyCap("my-ad-unit"); // fails open → false
```

Both entry points share the same core — the provider is a thin delegate.

### 2. Interstitial

```ts
import { SimulaInterstitialAd, SimulaAdEventType } from "@simula/ads";

const ad = new SimulaInterstitialAd("my-ad-unit");

ad.addAdEventListener(SimulaAdEventType.LOADED, () => ad.show());
ad.addAdEventListener(SimulaAdEventType.PAID, ({ adValue }) => {
  analytics.track("ad_paid", adValue.expectedRevenue, adValue.currencyCode);
});
ad.addAdEventListener(SimulaAdEventType.LOAD_FAILED, ({ error }) => {
  if (error.code === "duplicate_request") wait(error.retryInSeconds * 1000);
});

ad.load(); // optional character targeting: { charId, charName, charImage, charDesc }
```

Behavior (native parity): loaded ads expire after **1 hour**; same-key re-loads are throttled **5 minutes**; the next ad is **auto-preloaded on close**; close chrome (countdown ring / progress bar / delay up to 45s) is fully server-driven via `ad_behavior`.

### 3. Rewarded (play-to-earn)

```ts
import { SimulaRewardedAd, SimulaRewardedAdEventType } from "@simula/ads";

const ad = new SimulaRewardedAd("my-rewarded-unit");

ad.addAdEventListener(SimulaRewardedAdEventType.EARNED_REWARD, () => {
  // client-side gate elapsed (ad_behavior.close.delay_seconds)
});
ad.addAdEventListener(SimulaRewardedAdEventType.REWARD_VERIFIED, ({ rewardToken }) => {
  grantReward(rewardToken); // SSV-verified; token is your idempotency key
});

ad.load();
```

Verification is durable and idempotent (HTTP 409 → success, 5s→60s backoff, survives page reload) — a reward is never silently lost.

### 4. Native inline ad

```tsx
import { NativeBanner } from "@simula/ads";

<NativeBanner
  slot="feed"
  position={index}
  theme="system"                 // "dark" | "light" | "system"
  width="100%"                   // min 300px enforced
  onImpression={(data) => {}}    // MRC: ≥50% visible, 1 continuous second
  onPaid={(adValue) => {}}       // co-fired with the impression
  onClick={() => {}}
  onError={(err) => {}}          // { code, message }
/>
```

Preload for instant feed rendering:

```ts
const preloadedAdId = await SimulaAds.preloadNativeAd({ adUnitId: "feed", position: 0, theme: "dark" });
// …later: <NativeBanner slot="feed" position={0} preloadedAdId={preloadedAdId} />
SimulaAds.invalidateNativeAds(); // clear cached fills
```

### 5. Privacy

```ts
import { SimulaPrivacy } from "@simula/ads";

SimulaPrivacy.update({ tcString, uspString: "1YNN", gppString, gppSid, gdprApplies: true });
SimulaPrivacy.clearConsent();
```

The SDK auto-reads the page's IAB CMP (`__tcfapi` / `__uspapi` / `__gpp`), sends `X-Simula-*` consent headers on every request, embeds the `privacy` block in session creation, re-creates the session on consent change (300ms debounce), and degrades `localStorage` to in-memory when TCF Purpose 1 is denied under GDPR. COPPA suppresses the `primaryUserID` end-to-end.

### 6. Mini games

```tsx
import { MiniGameMenu, MiniGameInviteKit } from "@simula/ads";

<MiniGameMenu isOpen={open} onClose={...} charName="Luna" charID="char-123" charImage="https://…" messages={messages} />
```

---

## Events (cross-platform contract)

| Event | Meaning |
|---|---|
| `LOADED` / `LOAD_FAILED` | creative ready / failed (`error.code` + `retryInSeconds`) |
| `DISPLAYED` | shown signal (full-screen presented) |
| `IMPRESSION` | billable (~2s after render full-screen; MRC viewability for native) |
| `PAID` | estimated revenue (`AdValue`), co-fired with `IMPRESSION` |
| `CLICKED` | creative CTA tap |
| `CLOSED` | dismissed |
| `EARNED_REWARD` | reward gate elapsed (rewarded) |
| `REWARD_VERIFIED` / `REWARD_VERIFICATION_FAILED` | SSV result (rewarded) |

Error codes: `not_initialized, no_session, no_fill, not_ready, stale, duplicate_request, already_showing, no_presentation_context, network, ad_unit_not_found`.

## Migration to 2.0 (breaking changes)

- **`NativeBanner` callbacks reshaped** (native parity): `onImpression(ad)` → `onImpression(data: NativeAdData { impressionId, adFormat, adUnitId })`; `onError(Error)` → `onError({ code, message })`; `onLoad(ad)` → `onLoad(data)`; new `onPaid(AdValue)` and `onClick()`.
- **`context` prop is now optional** — merged over the global `SimulaAds.updateContext` value.
- **Minimum card width is now 300px** (was 130px), matching the native SDKs.
- **`useSimula()` no longer throws** outside a provider — it returns an inert context and ad surfaces render blank.
- **Validators no longer throw in production** (invalid props log + render blank); `devMode` keeps strict throwing for integration debugging.
- Zero runtime dependencies: `@fingerprintjs/botd` and `uuid` were removed (bot detection is now built-in heuristics).

## Support

- **Website:** [simula.ad](https://simula.ad)
- **Email:** [admin@simula.ad](mailto:admin@simula.ad)

## License

MIT
