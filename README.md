# Simula Ad SDK

## Overview

The Simula Ad SDK enables React developers to monetize conversational AI applications with contextually relevant, non-intrusive ads. The SDK provides in-chat ad placements and native banner ads that integrate naturally with chat interfaces.

### Key Features

- **Contextual Targeting** - AI-powered ad matching based on conversation content
- **In-Chat Ad Slots** - Ad placements that blend seamlessly into chat UIs
- **Native Banner Ads** - Flexible ad placements for feeds and content surfaces
- **MRC-Compliant Viewability** - Industry-standard impression tracking
- **Built-in A/B Testing** - Optimize ad performance automatically

---

## Installation

```bash
npm install @simula/ads
```

---

## Quick Start

### 1. Provider Setup

Wrap your chat/conversation component with `SimulaProvider` to initialize the SDK:

```tsx
import { SimulaProvider } from "@simula/ads";

function ChatInterface() {
  return (
    <SimulaProvider
      apiKey="SIMULA_xxx"
      primaryUserID="user-123"       // Optional: User ID for better ad targeting
      hasPrivacyConsent={true}       // Optional: Privacy consent flag
      devMode={false}                // Optional: Enable dev mode for testing
    >
      {/* Your chat UI */}
    </SimulaProvider>
  );
}
```

### 2. Component Integration

Add components where you want ads to appear:

**In-Chat Ads:**
```tsx
import { InChatAdSlot } from "@simula/ads";

<InChatAdSlot
  messages={messages.slice(0, i + 1)}
  theme={{ mode: "light", accent: "blue" }}
  onImpression={(ad) => console.log("Impression:", ad.id)}
  onError={(err) => console.error("Ad error:", err)}
/>
```

**Native Banner Ads:**
```tsx
import { NativeBanner } from "@simula/ads";

<NativeBanner
  slot="feed"
  position={index}
  context={{
    searchTerm: "cooking recipes",
    tags: ["food", "cooking"],
  }}
  width="100%"
  onImpression={(ad) => console.log("Impression:", ad.id)}
  onError={(err) => console.error("Error:", err)}
/>
```

---

## Documentation

For complete API reference, integration guides, and examples:

- **[InChatAdSlot Documentation](https://simula-ad.notion.site/?pvs=73)**
- **[NativeBanner Documentation](https://simula-ad.notion.site/Komiko-Simula-Integration-2cbaf70f6f0d80338ddcd2efbbe5d3d7?source=copy_link)**

---

## Support

- **Website:** [simula.ad](https://simula.ad)
- **Email:** [admin@simula.ad](mailto:admin@simula.ad)

---

## License

MIT
