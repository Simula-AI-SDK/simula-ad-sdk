# Mock Data for Testing

This folder contains mock ad data for easy testing without needing a backend server.

## 🚀 **How to Enable Testing Mode**

Just add `devMode={true}` to your SimulaProvider:

```typescript
import { SimulaProvider, AdSlot } from '@simula/ads';

function App() {
  return (
    <SimulaProvider devMode={true}>
      <AdSlot
        messages={[{ role: "user", content: "Hello!" }]}
        trigger={Promise.resolve()}
        theme={{
          theme: 'dark',
          accent: 'purple',
          font: 'san-serif',
          width: 400,
          mobileWidth: 320
        }}
        onImpression={(ad) => console.log('Mock impression:', ad)}
      />
    </SimulaProvider>
  );
}
```

**That's it!** The SDK will now serve beautiful mock ads instead of calling the real API.

## ✨ **What You Get**

- **Beautiful Ad Design**: Professional Grammarly-style ad with glassmorphism
- **Full Theme Support**: Colors, sizing, mobile breakpoints all work
- **Data URLs**: Ads embedded as base64 HTML (no external files needed)
- **Realistic Behavior**: Simulated API delays, click tracking, impression logging
- **Zero Setup**: No servers, no installation, just works

## 🧪 **What is Testing Mode?**

Testing mode makes the SDK use **mock data** instead of real API calls:

- ✅ **No backend needed** - works completely offline
- ✅ **Instant setup** - just one line of code
- ✅ **Beautiful ads** - same designs, your custom theme applied
- ✅ **Realistic behavior** - simulated delays, click tracking, impressions
- ✅ **Perfect for development, demos, and testing**

## 🔄 **Switching Back to Production**

To use the real API, just remove `devMode` and add your API key:

```typescript
<SimulaProvider apiKey="your-production-api-key">
  {/* Now uses production API */}
</SimulaProvider>
```

## 📦 **Available Exports**

```typescript
import { 
  mockAds,           // Array of mock ad data
  getMockAd,         // Function to get the mock ad
  mockFetchAd,       // Mock fetch function
  mockTrackImpression // Mock tracking function
} from '@simula/ads';
```

## 🎨 **Theme Testing**

All theme parameters work perfectly in mock mode:

```typescript
theme={{
  primary: '#your-brand-color',
  secondary: '#your-secondary-color', 
  border: '#your-border-color',
  width: 500,
  mobileWidth: 350,
  minWidth: 280,
  mobileBreakpoint: 768
}}
```

Mock ads will automatically apply your theme colors and sizing!

## 💡 **When to Use Testing Mode**

- 🧪 **Development** - Build features without backend dependency
- 🎨 **Theme Testing** - See your brand colors applied instantly  
- 📱 **Component Testing** - Perfect for Storybook or unit tests
- 🎭 **Demos** - Show ads to stakeholders immediately
- 🔍 **Debugging** - Test viewability, bot detection, UI behavior
- 🚀 **CI/CD** - Run tests without external dependencies

**Testing mode gives you everything you need for 95% of development work!** 