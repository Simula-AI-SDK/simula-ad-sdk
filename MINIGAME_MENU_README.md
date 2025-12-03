# MiniGameMenu Component

**Game Pigeon-style modal for displaying sponsored mini-games**

The `MiniGameMenu` component provides a beautiful, customizable modal interface for displaying and launching sponsored mini-games. Publishers can implement their own button to open this menu, giving users access to a curated selection of games.

---

## 🚀 Quick Start

```tsx
import { MiniGameMenu } from "@simula/ads";
import { useState } from "react";

function ChatApp() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <button onClick={() => setMenuOpen(true)}>🎮 Play Games</button>

      <MiniGameMenu
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        charName="Luna"
        charID="luna-123"
        charImage="https://example.com/avatars/luna.png"
      />
    </>
  );
}
```

---

## 📋 Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `isOpen` | `boolean` | ✅ | — | Controls modal visibility |
| `onClose` | `() => void` | ✅ | — | Callback when modal closes |
| `charName` | `string` | ✅ | — | Character name displayed in header |
| `charID` | `string` | ✅ | — | Character identifier (included in game iframe URL) |
| `charImage` | `string` | ✅ | — | Character avatar/image URL |
| `messages` | `Message[]` | ❌ | `[]` | Recent conversation history |
| `charDesc` | `string` | ❌ | `undefined` | Character description shown below name |
| `maxGamesToShow` | `3 \| 6 \| 9` | ❌ | `6` | Number of games displayed per page |
| `theme` | `MiniGameTheme` | ❌ | See below | Visual styling configuration |

### `Message` Interface

```typescript
interface Message {
  role: 'user' | 'assistant';
  content: string;
}
```

### `MiniGameTheme` Interface

```typescript
interface MiniGameTheme {
  backgroundColor?: string;         // Optional - used for modal background, icon backgrounds, and character avatar. Supports rgba() with opacity (e.g., 'rgba(255, 0, 0, 0.5)')
  headerColor?: string;             // Optional - used for header background color. Supports rgba() with opacity
  borderColor?: string;             // Optional - used for separator line and game card borders. Default: 'rgba(0, 0, 0, 0.08)'
  titleFont?: string;               // Default: 'Inter, system-ui, sans-serif'
  secondaryFont?: string;           // Default: 'Inter, system-ui, sans-serif'
  titleFontColor?: string;          // Default: '#1F2937' (gray-800)
  secondaryFontColor?: string;      // Default: '#6B7280' (gray-500)
  iconCornerRadius?: number;       // Default: 8 (border radius in pixels, 0 for square)
}
```

---

## 🎨 Theme Customization

### Default Theme

```typescript
const defaultTheme = {
  backgroundColor: undefined,       // Optional - defaults to white for modal, transparent for icons
  headerColor: undefined,          // Optional - no default color
  borderColor: 'rgba(0, 0, 0, 0.08)', // Subtle border color for separator and cards
  titleFont: 'Inter, system-ui, sans-serif',
  secondaryFont: 'Inter, system-ui, sans-serif',
  titleFontColor: '#1F2937',          // Gray-800
  secondaryFontColor: '#6B7280',     // Gray-500
  iconCornerRadius: 8,              // 8px border radius
};
// Note: Backdrop overlay is always 'rgba(0, 0, 0, 0.5)' and cannot be customized
```

### Custom Theme Example

```tsx
<MiniGameMenu
  isOpen={menuOpen}
  onClose={() => setMenuOpen(false)}
  charName="Luna"
  charID="luna-123"
  charImage="https://example.com/avatars/luna.png"
  theme={{
    backgroundColor: 'rgba(59, 130, 246, 0.1)',  // Light blue with opacity for modal background
    headerColor: 'rgba(37, 99, 235, 0.2)',       // Darker blue with opacity for header
    titleFont: 'Roboto, sans-serif',
    secondaryFont: 'Roboto, sans-serif',
    titleFontColor: '#111827',
    secondaryFontColor: '#4B5563',
    iconCornerRadius: 50,          // Fully circular icons (50px radius for 100px container)
  }}
/>
```

---

## 📖 Usage Examples

### Minimal Implementation

```tsx
import { MiniGameMenu } from "@simula/ads";
import { useState } from "react";

function GameButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button onClick={() => setIsOpen(true)}>
        🎮 Play Games with Luna
      </button>

      <MiniGameMenu
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        charName="Luna"
        charID="luna-123"
        charImage="https://example.com/avatars/luna.png"
      />
    </>
  );
}
```

### Full Implementation with All Props

```tsx
import { MiniGameMenu, Message } from "@simula/ads";
import { useState } from "react";

function ChatInterface() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'user', content: 'Hello!' },
    { role: 'assistant', content: 'Hi there! Want to play a game?' },
  ]);

  return (
    <>
      <button onClick={() => setMenuOpen(true)}>🎮 Games</button>

      <MiniGameMenu
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        charName="Luna"
        charID="luna-123"
        charImage="https://example.com/avatars/luna.png"
        messages={messages}
        charDesc="A playful AI companion who loves games"
        maxGamesToShow={9}
        theme={{
          backgroundColor: '#7C3AED',
          titleFont: 'Inter, system-ui, sans-serif',
          secondaryFont: 'Inter, system-ui, sans-serif',
          titleFontColor: '#1F2937',
          secondaryFontColor: '#6B7280',
          iconCornerRadius: 50,
          backgroundOpacity: 0.6,
        }}
      />
    </>
  );
}
```

### Integration with Chat Interface

```tsx
import { MiniGameMenu, Message } from "@simula/ads";
import { useState } from "react";

function ChatApp() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);

  const handleSendMessage = (content: string) => {
    setMessages([...messages, { role: 'user', content }]);
    // ... handle AI response
  };

  return (
    <div className="chat-container">
      <div className="chat-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.role}`}>
            {msg.content}
          </div>
        ))}
      </div>

      <div className="chat-actions">
        <button onClick={() => setMenuOpen(true)}>
          🎮 Play Games
        </button>
        {/* Other action buttons */}
      </div>

      <MiniGameMenu
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        charName="Luna"
        charID="luna-123"
        charImage="/avatars/luna.png"
        messages={messages}
        charDesc="Your AI gaming companion"
      />
    </div>
  );
}
```

---

## 🎮 Game Selection & Launch

When a user clicks on a game card:

1. The modal closes automatically
2. A full-screen iframe opens with the selected game
3. The game URL includes:
   - Game ID: `https://games.simula.ad/play/{gameId}`
   - Session token: Generated using `crypto.randomUUID()`
   - Character ID: `?charID={charID}`

### Console Logging

The component logs game launches for debugging:

```javascript
console.log('Game launched:', { gameId: 'blackjack', charID: 'luna-123' });
console.log('Menu closed');
```

---

## 🎯 Features

### Modal Behavior

- **Controlled Component**: Modal visibility controlled by `isOpen` prop
- **Click Outside**: Clicking the backdrop closes the modal
- **ESC Key**: Press ESC to close modal or game iframe
- **Focus Trap**: Keyboard navigation stays within the modal
- **Smooth Animations**: Slide-up on open, slide-down on close

### Game Grid

- **Layout**: 
  - Always displays 3 columns (mobile and desktop)
  - Responsive sizing: Icons and fonts scale down on mobile to fit on one screen
- **Pagination**: 
  - Shows 3, 6, or 9 games per page (configurable)
  - Navigation arrows when more games available
  - Page indicator (e.g., "1 / 2")
- **Game Cards**:
  - Emoji icons with customizable corner style (rounded/circular)
  - Game name below icon
  - Hover description tooltip
  - Scale animation on hover
  - Mobile: Smaller icons (50px) and fonts (11px) to fit 3 columns
  - Desktop: Larger icons (80px) and fonts (14px)

### Character Display

- **Avatar Image**: 
  - Circular avatar in header (40x40px)
  - Automatic fallback to initials if image fails to load
- **Header Text**: 
  - "Play a Game with {charName}"
  - Optional character description below name

### Full-Screen Game Iframe

- **Full Viewport Coverage**: z-index 9999
- **Dark Overlay**: Customizable opacity (default 0.8)
- **Close Button**: X button in top-right corner
- **Session Tracking**: Includes `charID` in URL for analytics

---

## 🎨 Styling Details

### Modal Dimensions

- **Min Width**: 320px
- **Min Height**: 400px
- **Max Width**: 600px (centered on screen)
- **Max Height**: 90vh (scrollable content area)
- **Responsive**: Adjusts for mobile and desktop viewports

### Theme Colors Applied To

- **Background Color**: Modal background, game icon backgrounds, pagination buttons, character avatar background (optional - defaults to white for modal, transparent for icons). Supports rgba() values with opacity (e.g., 'rgba(255, 0, 0, 0.5)')
- **Header Color**: Header background color (optional - no default, inherits from modal background). Supports rgba() values with opacity
- **Border Color**: Separator line and game card borders (optional - defaults to 'rgba(0, 0, 0, 0.08)'). Supports rgba() values with opacity
- **Backdrop Overlay**: Always 'rgba(0, 0, 0, 0.5)' - cannot be customized
- **Title Font Color**: Character name, game names
- **Secondary Font Color**: Character description, pagination text

### Icon Corner Radius

- **Number value**: Border radius in pixels (e.g., `8` for 8px, `50` for fully circular on 100px container)
- **Default**: `8` (8px border radius)
- **Set to `0`**: Square icons with no rounding

---

## ♿ Accessibility

- **Keyboard Navigation**: 
  - Tab through interactive elements
  - Enter/Space to select games
  - ESC to close
- **ARIA Labels**: 
  - Modal has `aria-modal="true"`
  - Buttons have descriptive `aria-label` attributes
  - Game cards have `role="button"` and `aria-label`
- **Focus Management**: 
  - Focus trap keeps navigation within modal
  - Focus restored to previous element on close

---

## 🔧 Advanced Usage

### Dynamic Character Switching

```tsx
function MultiCharacterApp() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [currentChar, setCurrentChar] = useState({
    name: "Luna",
    id: "luna-123",
    image: "/avatars/luna.png",
  });

  return (
    <>
      <button onClick={() => setMenuOpen(true)}>Play Games</button>

      <MiniGameMenu
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        charName={currentChar.name}
        charID={currentChar.id}
        charImage={currentChar.image}
      />
    </>
  );
}
```

### Custom Game Selection Handler

```tsx
function CustomGameHandler() {
  const [menuOpen, setMenuOpen] = useState(false);

  const handleGameSelect = (gameId: string) => {
    // Custom logic before opening game
    console.log(`User selected: ${gameId}`);
    // Game iframe will open automatically
  };

  // Note: The component handles game selection internally
  // This is just for reference - you can listen to console logs
  return (
    <MiniGameMenu
      isOpen={menuOpen}
      onClose={() => setMenuOpen(false)}
      charName="Luna"
      charID="luna-123"
      charImage="/avatars/luna.png"
    />
  );
}
```

---

## 🐛 Troubleshooting

### Image Not Loading

If the character image fails to load, the component automatically falls back to displaying the character's initials in a colored circle.

### Modal Not Closing

Ensure you're using the controlled component pattern correctly:
- `isOpen` prop controls visibility
- `onClose` callback updates the state that controls `isOpen`

```tsx
// ✅ Correct
const [isOpen, setIsOpen] = useState(false);
<MiniGameMenu isOpen={isOpen} onClose={() => setIsOpen(false)} />

// ❌ Incorrect - don't manage state inside the component
<MiniGameMenu isOpen={true} onClose={() => {}} />
```

### Games Not Displaying

The component uses mock game data by default. If you need to customize the games list, you'll need to modify the `mockGames.ts` file in the component source.

---

## 📝 TypeScript Support

Full TypeScript support is included. Import types as needed:

```typescript
import { 
  MiniGameMenu, 
  MiniGameMenuProps, 
  MiniGameTheme,
  Message 
} from "@simula/ads";

// Use in your component
const props: MiniGameMenuProps = {
  isOpen: true,
  onClose: () => {},
  charName: "Luna",
  charID: "luna-123",
  charImage: "/avatars/luna.png",
};
```

---

## 🔗 Related Components

- **`SimulaProvider`**: Required wrapper for other Simula components (not required for MiniGameMenu)
- **`InChatAdSlot`**: Display contextual ads in chat conversations

---

## 📚 Additional Resources

- [Main SDK Documentation](./README.md)
- [Simula Dashboard](https://simula.ad)
- [Support](mailto:support@simula.ad)

---

## 💡 Best Practices

1. **Controlled State**: Always use controlled component pattern with `isOpen` and `onClose`
2. **Character Images**: Provide high-quality avatar images (recommended: 80x80px or larger)
3. **Theme Consistency**: Match your app's color scheme using the `theme` prop
4. **User Experience**: Place the game button in an easily accessible location
5. **Accessibility**: Ensure your trigger button has proper ARIA labels

---

**Need help?** Contact [support@simula.ad](mailto:support@simula.ad) or visit [simula.ad](https://simula.ad)

