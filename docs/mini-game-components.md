# MiniGame Components

Drop-in components that drive users into the `MiniGameMenu`. Import from `@simula/ads`.

```tsx
import { MiniGameMenu, MiniGameInviteKit } from '@simula/ads';

<MiniGameMenu ... />
<MiniGameInviteKit.Invitation ... />
<MiniGameInviteKit.Button ... />
<MiniGameInviteKit.Interstitial ... />
```

Individual imports also available: `import { MiniGameInvitation, MiniGameButton, MiniGameInterstitial } from '@simula/ads'`

---

## MiniGameInvitation

Inline card with character image, text, and a CTA button. Supports smart triggers for automatic display.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `charImage` | `string` | **required** | Character image URL |
| `titleText` | `string` | `'Want to play a game?'` | Heading text |
| `subText` | `string` | `'Take a break and challenge yourself!'` | Secondary text |
| `ctaText` | `string` | `'Play a Game'` | CTA button label |
| `animation` | `'auto' \| 'slideDown' \| 'slideUp' \| 'fadeIn' \| 'none'` | `'auto'` | Entry/exit animation. `auto` = slideDown |
| `isOpen` | `boolean` | `false` | Controls visibility. Ignored when `trigger` is set |
| `trigger` | `MiniGameInvitationTrigger` | — | Auto-show based on user behavior (see below) |
| `autoCloseDuration` | `number` | — | Ms before auto-close. Omit to stay open |
| `onClick` | `() => void` | **required** | CTA button click handler |
| `onClose` | `() => void` | — | Optional callback when the invitation closes (dismiss, auto-close, CTA). Component closes itself internally regardless. ✕ button always shown |
| `theme` | `MiniGameInvitationTheme` | — | See theme table |

### Trigger

When `trigger` is provided, the component manages its own visibility — no need to control `isOpen`.

| Field | Type | Description |
|-------|------|-------------|
| `onIdle` | `number` | Show after user is idle for this many ms |
| `afterDelay` | `number` | Show after this many ms from mount |
| `onScrollPercent` | `number` | Show when user scrolls past this % of the page (0–100) |

### Theme

| Field | Type | Default |
|-------|------|---------|
| `cornerRadius` | `number` | `16` |
| `primaryColor` | `string` | `'#FFFFFF'` |
| `secondaryColor` | `string` | `'#F3F4F6'` |
| `textColor` | `string` | `'#1F2937'` |
| `ctaColor` | `string` | `'#3B82F6'` |
| `charImageCornerRadius` | `number` | `12` |

### Usage

```tsx
// Manual control
<MiniGameInviteKit.Invitation
  isOpen={showInvite}
  charImage="/natsuki.png"
  onClick={() => setShowMenu(true)}
  onClose={() => setShowInvite(false)}
  autoCloseDuration={8000}
/>

// Smart trigger — shows after 10s idle, no state management needed
<MiniGameInviteKit.Invitation
  trigger={{ onIdle: 10000 }}
  charImage="/natsuki.png"
  onClick={() => setShowMenu(true)}
/>
```

---

## MiniGameButton

Styled button with optional pulsate animation and notification badge.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `text` | `string` | `'🎮 Play a Game'` | Button label |
| `showPulsate` | `boolean` | `false` | Pulsating glow animation |
| `showBadge` | `boolean` | `false` | Red notification dot |
| `onClick` | `() => void` | **required** | Click handler |
| `theme` | `MiniGameButtonTheme` | — | See theme table |

### Theme

| Field | Type | Default |
|-------|------|---------|
| `cornerRadius` | `number` | `8` |
| `primaryColor` | `string` | `'#3B82F6'` |
| `fontColor` | `string` | `'#FFFFFF'` |
| `padding` | `string \| number` | `'10px 20px'` |

### Usage

```tsx
<MiniGameInviteKit.Button
  onClick={() => setShowMenu(true)}
  showPulsate
  showBadge
/>

<MiniGameInviteKit.Button
  text="Challenge Me"
  onClick={() => setShowMenu(true)}
  theme={{ primaryColor: '#8B5CF6' }}
/>
```

---

## MiniGameInterstitial

Fullscreen overlay with character image in a circle, invitation text, and CTA. Supports custom background images.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `charImage` | `string` | **required** | Character image URL |
| `invitationText` | `string` | `'Want to play a game?'` | Main text |
| `ctaText` | `string` | `'Play a Game'` | CTA button label |
| `backgroundImage` | `string` | bundled default | Background image URL. Uses bundled image if omitted |
| `isOpen` | `boolean` | **required** | Controls visibility |
| `onClick` | `() => void` | **required** | CTA button click handler |
| `onClose` | `() => void` | — | Optional callback when the interstitial closes (backdrop click, ESC, "Not now", CTA). Component closes itself internally regardless |
| `theme` | `MiniGameInterstitialTheme` | — | See theme table |

### Theme

| Field | Type | Default |
|-------|------|---------|
| `cornerRadius` | `number` | `16` |
| `characterSize` | `number` | `120` |
| `textColor` | `string` | `'#FFFFFF'` |
| `textSize` | `number` | `24` |

### Usage

```tsx
<MiniGameInviteKit.Interstitial
  isOpen={showInterstitial}
  charImage="/natsuki.png"
  invitationText="Ready for a challenge?"
  ctaText="Let's Go"
  backgroundImage="/game-bg.jpg"
  onClick={() => setShowMenu(true)}
  onClose={() => setShowInterstitial(false)}
/>
```

---

## Full Example

All three components wired together with `MiniGameMenu`:

```tsx
import { MiniGameMenu, MiniGameInviteKit } from '@simula/ads';

function App() {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <>
      {/* Auto-shows after 10s idle, auto-closes after 8s */}
      <MiniGameInviteKit.Invitation
        trigger={{ onIdle: 10000 }}
        autoCloseDuration={8000}
        charImage="/natsuki.png"
        onClick={() => setShowMenu(true)}
      />

      {/* Always-visible button with attention indicators */}
      <MiniGameInviteKit.Button
        onClick={() => setShowMenu(true)}
        showPulsate
        showBadge
      />

      {/* The game menu itself */}
      <MiniGameMenu
        isOpen={showMenu}
        onClose={() => setShowMenu(false)}
        charName="Natsuki"
        charID="natsuki-1"
        charImage="/natsuki.png"
      />
    </>
  );
}
```
