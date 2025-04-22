
# GenAI Ad SDK for Node.js

A lightweight Node.js SDK for embedding contextual, conversation-aware advertisements into chat applications powered by any LLM API. This library enables applications to pass user interactions and AI responses to a centralized ad engine, which returns stylistically aligned, context-relevant ads when appropriate.

---

## 🧩 Overview

The GenAI Ad SDK provides a universal interface for injecting ads into LLM-driven conversational apps. It performs:

- Profile enrichment and context tracking via full chat history
- Remote ad-matching and insertion logic based on metadata and language fidelity
- Simple drop-in integration with any LLM-compatible stack

All computation and inference are performed on the backend. The SDK sends session metadata and responses to a centralized API and receives fully rendered outputs (with or without ads).

---

## 🛠 Installation

```bash
npm install genai-ad-sdk
```

---

## 🔧 Initialization

```ts
import { AdInjector } from "genai-ad-sdk";

const adInjector = new AdInjector({
  description: "An AI travel planner that helps users plan vacations and book hotels.",
  frequency: 0.5,
  fidelity: 0.7,
  filters: ["crypto", "adult"]
});
```

### `.constructor(options)`

| Param         | Type       | Required | Description                                                                 |
|---------------|------------|----------|-----------------------------------------------------------------------------|
| `description` | `string`   | ✅       | A short description of your app’s function and target users                |
| `frequency`   | `number`   | ❌       | Float from 0–1. `0` = show ads rarely, `1` = show as often as appropriate. Default: `0.5` |
| `fidelity`    | `number`   | ❌       | Float from 0–1. Controls tone/style alignment of ad content. Default: `0.5` |
| `filters`     | `string[]` | ❌       | List of ad categories to exclude (see below). Default: `[]`               |

---

## 🔒 Supported Filters (Ad Categories)

You can optionally block ad categories by passing one or more of the following strings in the `filters` array:

```
["finance", "healthcare", "politics", "adult", "gaming", "crypto", "fitness", "education", "travel", "shopping"]
```

---

## ✅ Example Usage

```ts
import { AdInjector } from "genai-ad-sdk";

const adInjector = new AdInjector({
  description: "An AI companion for photography advice and equipment recommendations.",
  frequency: 0.8,
  fidelity: 1.0,
  filters: ["politics"]
});

// Step 1: Process full conversation history to update user profile
const messages = [
  { role: "system", content: "You're a helpful assistant." },
  { role: "user", content: "I'm thinking about getting a new camera." },
  { role: "assistant", content: "Do you prefer DSLR, mirrorless, or compact?" },
  { role: "user", content: "I want something small and lightweight for travel." }
];

await adInjector.process(messages);

// Step 2: Pass assistant response to determine if an ad should be inserted
const finalResponse = await adInjector.insertAd({
  history: messages,
  assistantResponse: "In that case, a mirrorless camera like the Fujifilm X-S10 is a great option for travelers."
});

console.log("Assistant:", finalResponse);
```

---

## 🧠 API Reference

### `adInjector.process(messages)`

Processes a full conversation history to build a contextual profile for ad targeting.

**Parameters:**

| Param     | Type   | Required | Description                                      |
|-----------|--------|----------|--------------------------------------------------|
| `messages`| `array`| ✅       | Full array of `{ role, content }` chat messages |

**Returns:** `Promise<void>`

---

### `adInjector.insertAd({ history, assistantResponse, options? })`

Submits a model response and context to determine whether an ad should be inserted.

**Parameters:**

| Param              | Type     | Required | Description                                                            |
|--------------------|----------|----------|------------------------------------------------------------------------|
| `history`          | `array`  | ✅       | Full array of `{ role, content }` chat messages                       |
| `assistantResponse`| `string` | ✅       | Raw assistant message to evaluate for ad insertion                    |
| `options`        | `object` | ❌       | Optional override of `frequency`, `fidelity`, or `filters` from init  |

**Returns:** `Promise<{ ad_placed: boolean; originalResponse: string; adResponse: string }>` — Returns whether an ad was placed, the original assistant response, and the final response (with or without an ad)

---

## 🧬 Behind the Scenes

The SDK does not perform any on-device inference. Instead, it sends the following to a hosted API:

- App description
- Session history
- Assistant response
- Initialization parameters
- Optional overrides

The backend:
- Profiles user behavior and interests
- Runs a lightweight context model
- Matches the response with a relevant ad (if appropriate)
- Returns a modified or unmodified assistant message

---


## 🧩 Future Roadmap

- Support for streaming completions (`insertAdStream`)
- Ad impression and engagement tracking callbacks
- Inline ad formatting utilities (e.g., badge, tooltip, expandable)
- TypeScript native types
- Configurable fallback if ad injection fails
