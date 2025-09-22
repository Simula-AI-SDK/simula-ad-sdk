Simula helps you monetize your app with contextual AI ads.

Integration takes **two steps**:

1. Initialize with `SimulaProvider`
2. Add `<AdSlot />`

---

## 1. Initialization

Wrap your app with `SimulaProvider` and pass your API key.

👉 You can find this key in the **Simula dashboard** (`https://simula.ad`) under your account settings.

```tsx
import { SimulaProvider } from "@simula/ads";
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
| `devMode` | boolean | ❌ No | Enable testing mode with mock ads (no API needed). |

### 🧪 **Development Mode**

For testing and development, use `devMode` to get beautiful mock ads without an API:

```tsx
<SimulaProvider devMode={true}>
  <AdSlot
    messages={[{ role: "user", content: "Hello!" }]}
    trigger={Promise.resolve()}
    theme={{ primary: '#your-brand-color' }}
  />
</SimulaProvider>
```

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
  theme?: 'light' | 'dark' | 'auto';           // Theme mode
  accent?: 'blue' | 'red' | 'green' | 'yellow' // Accent color
         | 'purple' | 'pink' | 'orange' | 'neutral'
         | 'gray' | 'tan';
  font?: 'san-serif' | 'serif' | 'monospace';  // Font family
  width?: number | "auto";                     // container width
  mobileWidth?: number;                        // width under breakpoint
  minWidth?: number;                           // minimum width
  mobileBreakpoint?: number;                   // breakpoint in px
};
```

### Theme Examples

```tsx
// Light blue theme
<AdSlot 
  theme={{ 
    theme: 'light', 
    accent: 'blue', 
    font: 'san-serif' 
  }} 
/>

// Dark purple theme
<AdSlot 
  theme={{ 
    theme: 'dark', 
    accent: 'purple', 
    font: 'serif' 
  }} 
/>

// Auto theme (follows system preference)
<AdSlot 
  theme={{ 
    theme: 'auto', 
    accent: 'green', 
    font: 'monospace' 
  }} 
/>
```

### Available Color Combinations

The theme system automatically generates beautiful color palettes for all combinations:

- **Theme modes**: `light`, `dark`, `auto`
- **Accent colors**: `blue`, `red`, `green`, `yellow`, `purple`, `pink`, `orange`, `neutral`, `gray`, `tan`
- **Fonts**: `san-serif`, `serif`, `monospace`

Each combination provides:
- Background gradients
- Primary/secondary button colors
- Border and text colors
- Hover states
- Shadows and surfaces


---

## Chat App Example with OpenAI

```tsx
import { useState } from "react";
import { AdSlot } from "@simula/ads";
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default function ChatApp() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [latestPromise, setLatestPromise] = useState(null);
  const [loading, setLoading] = useState(false);

  async function sendMessage() {
    if (!input.trim() || loading) return;
    
    const userMessage = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMessage];
    
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      // call OpenAI
      const llmPromise = client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: newMessages,
      });

      // store promise for AdSlot trigger
      setLatestPromise(llmPromise);

      // wait for response
      const res = await llmPromise;
      const reply = res.choices[0].message;

      // add assistant message
      setMessages((prev) => [...prev, reply]);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="chat-container">
      {/* Chat Messages */}
      <div className="messages">
        {messages.map((msg, i) => (
          <div key={i}>
            <div className={`message ${msg.role}`}>
              <strong>{msg.role === "user" ? "You" : "AI"}:</strong>
              <p>{msg.content}</p>
            </div>
            
            {/* Ad Slot - appears after each AI message */}
            {msg.role === "assistant" && (
              <AdSlot
                trigger={latestPromise}
                messages={messages.slice(0, i + 1).slice(-6)}  // context up to this message
                theme={{ 
                  primary: "#0EA5E9", 
                  secondary: "#0369A1",
                  background: "#ffffff",
                  width: "auto", 
                  mobileWidth: 320 
                }}
              />
            )}
          </div>
        ))}
        {loading && <div className="message assistant">AI is thinking...</div>}
      </div>

      {/* Input */}
      <div className="input-area">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Ask me anything..."
          disabled={loading}
        />
        <button onClick={sendMessage} disabled={loading || !input.trim()}>
          Send
        </button>
      </div>
    </div>
  );
}

```

---

✅ That’s it:

- Get your **API key from the Simula dashboard**
- Wrap your app with `SimulaProvider`
- Add `<AdSlot />` with `messages` + `trigger`

Simula automatically fetches, renders, sizes, tracks ads, and prevents bot fraud for you.