# Simula Ad SDK - Integration Guide

React SDK for integrating contextual advertising and mini-game components into conversational AI applications.

---

## Installation

```bash
npm install @simula/ads
```

**Requirements:**
- React 16.8.0 or higher
- TypeScript (recommended)

---

## Quick Start

### 1. Provider Setup

Wrap your application with `SimulaProvider` to initialize the SDK:

```tsx
import { SimulaProvider } from "@simula/ads";

function App() {
  return (
    <SimulaProvider apiKey="YOUR_API_KEY">
      {/* Your application components */}
    </SimulaProvider>
  );
}
```

**Provider Responsibilities:**
- Session management
- Ad request handling
- Impression tracking
- Bot detection
- Performance optimization

### 2. Component Integration

Add components where you want ads or games to appear. No additional configuration required.

---

## Components

### MiniGameMenu

Modal component for displaying and launching sponsored mini-games.

#### Basic Usage

```tsx
import { MiniGameMenu } from "@simula/ads";
import { useState } from "react";

function ChatInterface() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <button onClick={() => setMenuOpen(true)}>
        Play Games
      </button>

      <MiniGameMenu
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        charName="Luna"
        charID="luna-123"
        charImage="https://cdn.example.com/avatars/luna.png"
      />
    </>
  );
}
```

#### Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `isOpen` | `boolean` | Yes | - | Controls modal visibility |
| `onClose` | `() => void` | Yes | - | Close event handler |
| `charName` | `string` | Yes | - | Character name displayed in header |
| `charID` | `string` | Yes | - | Character identifier |
| `charImage` | `string` | Yes | - | Character avatar URL |
| `messages` | `Message[]` | No | `[]` | Conversation history for context |
| `charDesc` | `string` | No | - | Character description |
| `maxGamesToShow` | `3 \| 6 \| 9` | No | `6` | Games per page |
| `theme` | `MiniGameTheme` | No | `{}` | Theme configuration |

#### Theme Configuration

```typescript
interface MiniGameTheme {
  backgroundColor?: string;
  headerColor?: string;
  borderColor?: string;
  titleFont?: string;
  secondaryFont?: string;
  titleFontColor?: string;
  secondaryFontColor?: string;
  iconCornerRadius?: number;
}
```

**Example:**

```tsx
<MiniGameMenu
  isOpen={menuOpen}
  onClose={() => setMenuOpen(false)}
  charName="Luna"
  charID="luna-123"
  charImage="https://cdn.example.com/avatars/luna.png"
  messages={messages}
  charDesc="AI Assistant"
  maxGamesToShow={6}
  theme={{
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    titleFontColor: "#111827",
    iconCornerRadius: 12
  }}
/>
```

---

## Event Handlers

### Message Type

```typescript
interface Message {
  role: "user" | "assistant";
  content: string;
}
```

---

## Complete Example

```tsx
import { 
  SimulaProvider, 
  MiniGameMenu 
} from "@simula/ads";
import { useState } from "react";

function ChatApp() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [messages] = useState([]);

  return (
    <SimulaProvider apiKey="YOUR_API_KEY">
      <div className="app-layout">
        <main>
          <ChatInterface messages={messages} />
          <button onClick={() => setMenuOpen(true)}>
            Play Games
          </button>
        </main>

        <MiniGameMenu
          isOpen={menuOpen}
          onClose={() => setMenuOpen(false)}
          charName="Luna"
          charID="luna-123"
          charImage="https://cdn.example.com/avatars/luna.png"
          messages={messages}
        />
      </div>
    </SimulaProvider>
  );
}
```

---

## Backend Integration

The SDK works out-of-the-box with Simula's backend infrastructure. For custom integrations requiring authentication tokens, user data, or custom API endpoints, we can integrate with your backend.

### Integration Requirements

To integrate with your backend, provide:

1. **API endpoint URLs** - Endpoints for game session initialization, user data, etc.
2. **Authentication method** - API keys, OAuth tokens, or other authentication mechanisms
3. **Request/response schemas** - JSON format specifications

### Example: Token-Based Authentication

For games requiring authentication tokens:

1. User selects game in `MiniGameMenu`
2. SDK calls your endpoint: `POST /api/games/start-session`
3. Your backend returns: `{ token: "xyz123", gameUrl: "..." }`
4. SDK launches game with provided token

Backend integration is handled on Simula's side. No modifications to your backend code are required.

---

## Features

**Automatic Tracking:**
- MRC-compliant impression tracking
- Click tracking
- Viewability measurement
- Bot detection and blocking

**Performance:**
- Minimal bundle size
- Lazy loading
- Optimized rendering

**Accessibility:**
- Keyboard navigation
- Focus management
- ARIA labels

---

## TypeScript Support

Full TypeScript definitions are included. All components and types are exported from the main package:

```typescript
import type {
  MiniGameMenuProps,
  MiniGameTheme,
  Message
} from "@simula/ads";
```

---

## Support

- **Documentation**: https://simula.ad/docs
- **Dashboard**: https://simula.ad
- **Email**: support@simula.ad
