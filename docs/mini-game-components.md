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

Compact fixed-height card with character image, text, and a full-width CTA button. Defaults to a dark frosted-glass look (`backdrop-filter: blur`) for a modern aesthetic.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `charImage` | `string` | **required** | Character image URL |
| `titleText` | `string` | `'Want to play a game?'` | Heading text |
| `subText` | `string` | `'Take a break and challenge yourself!'` | Secondary text |
| `ctaText` | `string` | `'Play a Game'` | CTA button label |
| `animation` | `'auto' \| 'slideDown' \| 'slideUp' \| 'fadeIn' \| 'none'` | `'auto'` | Entry/exit animation. `auto` = slideDown |
| `isOpen` | `boolean` | `false` | Controls visibility |
| `autoCloseDuration` | `number` | — | Ms before auto-close. Omit to stay open |
| `width` | `number \| string \| null` | — | Component width. `< 1` = percentage, `>= 1` = px, `"80%"` = percentage, `"500"` = px, omit = 100% |
| `top` | `number \| string` | `0.05` (5%) | Distance from top of viewport. `< 1` = percentage, `>= 1` = px, `"5%"` = percentage. Always fixed + centered |
| `onClick` | `() => void` | **required** | CTA button click handler |
| `onClose` | `() => void` | — | Optional callback when the invitation closes (dismiss, auto-close, CTA). Component closes itself internally regardless. ✕ button always shown |
| `theme` | `MiniGameInvitationTheme` | — | See theme table |

### Theme

| Field | Type | Default |
|-------|------|---------|
| `cornerRadius` | `number` | `16` |
| `backgroundColor` | `string` | `'rgba(0, 0, 0, 0.65)'` |
| `textColor` | `string` | `'#FFFFFF'` |
| `titleTextColor` | `string` | `'#FFFFFF'` |
| `subTextColor` | `string` | `'#FFFFFF'` |
| `ctaTextColor` | `string` | `'#FFFFFF'` |
| `ctaColor` | `string` | `'#3B82F6'` |
| `charImageCornerRadius` | `number` | `12` |
| `charImageAnchor` | `'left' \| 'right'` | `'left'` |
| `borderWidth` | `number` | `1` |
| `borderColor` | `string` | `'rgba(255, 255, 255, 0.1)'` |
| `fontFamily` | `string` | `'Inter, system-ui, sans-serif'` |

### Usage

```tsx
<MiniGameInviteKit.Invitation
  isOpen={showInvite}
  charImage="/natsuki.png"
  onClick={() => setShowMenu(true)}
  onClose={() => setShowInvite(false)}
  autoCloseDuration={8000}
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
| `width` | `number \| string \| null` | — | Button width. `< 1` = percentage, `>= 1` = px, `"80%"` = percentage, `"500"` = px, omit = content-sized |
| `onClick` | `() => void` | **required** | Click handler |
| `theme` | `MiniGameButtonTheme` | — | See theme table |

### Theme

| Field | Type | Default |
|-------|------|---------|
| `cornerRadius` | `number` | `8` |
| `backgroundColor` | `string` | `'#3B82F6'` |
| `textColor` | `string` | `'#FFFFFF'` |
| `fontSize` | `number` | `14` |
| `padding` | `string \| number` | `'10px 20px'` |
| `borderWidth` | `number` | `0` |
| `borderColor` | `string` | `'transparent'` |
| `pulsateColor` | `string` | backgroundColor |
| `badgeColor` | `string` | `'#EF4444'` |

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
  theme={{ backgroundColor: '#8B5CF6' }}
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
| `ctaCornerRadius` | `number` | `16` |
| `characterSize` | `number` | `120` |
| `titleTextColor` | `string` | `'#FFFFFF'` |
| `titleFontSize` | `number` | `24` |
| `ctaTextColor` | `string` | `'#FFFFFF'` |
| `ctaFontSize` | `number` | `16` |
| `ctaColor` | `string` | `'#3B82F6'` |
| `fontFamily` | `string` | `'Inter, system-ui, sans-serif'` |

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
      {/* Invitation card, auto-closes after 8s */}
      <MiniGameInviteKit.Invitation
        isOpen={!showMenu}
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
