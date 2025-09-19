Simula helps you monetize your app with contextual AI ads.

Integration takes **two steps**:

1. Initialize with `SimulaProvider`
2. Add `<AdSlot />`

---

## 1. Initialization

Wrap your app with `SimulaProvider` and pass your API key.

👉 You can find this key in the **Simula dashboard** (`https://simula.ad`) under your account settings.

```tsx
import { SimulaProvider } from "@simula/sdk-react";
import ChatApp from "./ChatApp";

export default function App() {
  return (
    <SimulaProvider apiKey="SIMULA_xxx">
      <ChatApp />
    </SimulaProvider>
  );
}

```

**Props**

| Prop | Type | Required | Description |
| --- | --- | --- | --- |
| `apiKey` | string | ✅ Yes | Your Simula API key from the dashboard. |

---

## 2. Displaying an Ad

Use `<AdSlot />` anywhere in your UI.

You must provide the latest conversation messages and a trigger for when to fetch.

### Example: Promise trigger (recommended)

```tsx
<AdSlot
  trigger={latestLLMPromise}         // fetches after your LLM call finishes
  messages={messages.slice(-6)}      // last few messages as context
  formats={["all"]}
  theme={{
    primary: "#0EA5E9",
    secondary: "#0369A1",
    border: "#E2E8F0",
    width: "auto",
    mobileWidth: 320,
    minWidth: 280,
    mobileBreakpoint: 768,
  }}
/>

```

---

## `<AdSlot />` Props

### Mandatory

| Prop | Type | Description |
| --- | --- | --- |
| `messages` | Array | Recent chat messages (`{ role, content }[]`). Recommended: last 6 turns. |
| `trigger` | Promise | Trigger | When to fetch an ad. Usually the promise returned by your LLM API call. |

### Optional

| Prop | Type | Description |
| --- | --- | --- |
| `formats` | Array | Ad types (`["all"]`, `["text"]`, `["prompt"]`, etc.). |
| `theme` | Object | Colors and sizing (see below). |
| `slotId` | string | Custom ID for this ad placement (analytics). |
| `debounceMs` | number | Delay before sending request, in ms. Default: **0**. |
| `minIntervalMs` | number | Minimum gap between requests, in ms. Default: **1000**. |
| `onlyWhenVisible` | boolean | If true (default), waits until the ad is **actually visible in the viewport** before fetching. Saves bandwidth and ensures ads count as viewable impressions. Set `false` to preload off-screen. |
| `onImpression` | function | Fires when ad is visible. |
| `onClick` | function | Fires when user clicks the ad. |
| `onError` | function | Fires on error or no-fill. |

---

## `theme` Object

```tsx
type SimulaTheme = {
  primary?: string;          // hex color
  secondary?: string;        // hex color
  border?: string;           // hex color
  width?: number | "auto";   // container width
  mobileWidth?: number;      // width under breakpoint
  minWidth?: number;         // minimum width
  mobileBreakpoint?: number; // breakpoint in px
};

```

---

## Quick Chat Example with OpenAI

```tsx
import { useState } from "react";
import { AdSlot } from "@simula/sdk-react";
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default function ChatWithAds() {
  const [messages, setMessages] = useState([]);
  const [latestPromise, setLatestPromise] = useState(null);

  async function sendMessage(prompt) {
    // add user message
    setMessages((prev) => [...prev, { role: "user", content: prompt }]);

    // call OpenAI
    const llmPromise = client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [...messages, { role: "user", content: prompt }],
    });

    // store promise for AdSlot trigger
    setLatestPromise(llmPromise);

    // wait for response
    const res = await llmPromise;
    const reply = res.choices[0].message;

    // add assistant message
    setMessages((prev) => [...prev, reply]);
  }

  return (
    <div>
      <button onClick={() => sendMessage("What's the best note-taking app?")}>
        Ask
      </button>

      <AdSlot
        trigger={latestPromise}
        messages={messages.slice(-6)}
        theme={{ primary: "#0EA5E9", width: "auto", mobileWidth: 320 }}
      />
    </div>
  );
}

```

---

✅ That’s it:

- Get your **API key from the Simula dashboard**
- Wrap your app with `SimulaProvider`
- Add `<AdSlot />` with `messages` + `trigger`

---

## 🛡️ Bot Detection & Fraud Prevention

Simula includes **professional-grade bot detection** powered by **FingerprintJS BotD** to prevent ad fraud and protect advertisers from fake impressions.

### Automatic Protection

The SDK automatically:
- ✅ **Blocks ad requests** from detected bots
- ✅ **Prevents impression tracking** from automated traffic  
- ✅ **Uses industry-leading detection** from FingerprintJS team
- ✅ **Fails open gracefully** if detection library unavailable

### Detection Technology

Powered by **[@fingerprintjs/botd](https://github.com/fingerprintjs/BotD)** - the professional bot detection library:

- **Advanced automation detection**: Selenium, Puppeteer, Playwright, PhantomJS
- **Behavioral analysis**: Mouse movements, timing attacks, automation patterns  
- **Browser tampering detection**: Modified properties, injected scripts
- **Machine learning**: Continuously improving detection accuracy

---

## 📊 Simple Viewability & Professional Measurement

Simula provides clean, efficient viewability measurement with both simple and industry-standard options.

### Simple Viewability (Default)

The SDK automatically provides:
- ✅ **Clean Intersection Observer-based measurement** 
- ✅ **Professional impression tracking** for advertiser reporting  
- ✅ **Efficient viewability detection** with customizable thresholds
- ✅ **Sequential tracking flow** preventing duplicate impressions

### Available Options

- **`useViewability`**: Simple, efficient intersection observer (recommended for most use cases)
- **`useOMIDViewability`**: Full OMID integration (for enterprise/verification requirements)

---

## 🔧 Combined Usage

Both systems work together seamlessly for maximum protection and accuracy:

```tsx
import { useBotDetection, useViewability } from "@simula/sdk-react";

function MyAdComponent({ adId }: { adId: string }) {
  const { isBot, reasons } = useBotDetection();
  const { 
    elementRef, 
    isViewable, 
    hasBeenViewed, 
    trackImpression 
  } = useViewability({
    threshold: 0.5,
    onImpressionTracked: (adId) => {
      // Called after impression tracking
      console.log(`Backend tracking for ad: ${adId}`);
      // Your custom backend tracking logic here
    }
  });
  
  if (isBot) {
    return <div>Bot detected - no ads served</div>;
  }
  
  return (
    <div ref={elementRef}>
      {isViewable ? "Ad is viewable ✓" : "Ad not in view"}
      {hasBeenViewed && <span>Previously viewed</span>}
      <button onClick={() => trackImpression(adId)}>
        Track Impression
      </button>
    </div>
  );
}
```

**The Perfect Flow:**
1. **BotD**: Prevents fraud before it happens
2. **Viewability**: Tracks impression when actually viewable  
3. **Backend**: Gets pinged after viewability confirmation
4. **Callbacks**: All user callbacks triggered after successful tracking
5. **Result**: Single source of truth with sequential execution
- `isBot`: Boolean indicating if bot is detected by FingerprintJS BotD
- `reasons`: Array indicating detection status

---

Simula automatically fetches, renders, sizes, tracks ads, and prevents bot fraud for you.