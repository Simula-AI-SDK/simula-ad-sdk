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

Simula automatically fetches, renders, sizes, and tracks ads for you.