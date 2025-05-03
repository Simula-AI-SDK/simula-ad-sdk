# Simula Ad SDK

A Node.js module for injecting ads into AI assistant responses.

## Installation

```bash
npm install simula-ad-sdk
```

## Usage

The SDK provides a simple interface for processing AI conversation history and injecting ads into AI responses.

### CommonJS

```javascript
const { AdInjector } = require('simula-ad-sdk');

// Create an instance
const adInjector = new AdInjector({
  description: 'A chat application for fitness enthusiasts',
  frequency: 0.5,  // 50% chance of showing an ad
  fidelity: 0.7,   // Higher quality ads
  filters: ['inappropriate', 'irrelevant']  // Ad filters
});

// Process message history
const messages = [
  { role: 'user', content: 'How can I improve my workout?' },
  { role: 'assistant', content: 'There are several ways to improve...' }
];
adInjector.process(messages);

// Insert an ad into an assistant response
adInjector.insertAd({
  history: messages,
  assistantResponse: 'Here are some workout tips...',
  options: {
    // Optional additional parameters
    category: 'fitness-equipment'
  }
})
.then(result => {
  console.log(result.adResponse); // Response with ad inserted
})
.catch(error => {
  console.error('Error:', error);
});
```

### ES Modules

```javascript
import { AdInjector } from 'simula-ad-sdk';

// Same usage as above
```

## API

### AdInjector

#### Constructor

```javascript
new AdInjector(options)
```

- **options.description** (string, required): Description of the app and its users
- **options.frequency** (number, optional): Float between 0 and 1, default to 0.5
- **options.fidelity** (number, optional): Float between 0 and 1, default to 0.5
- **options.filters** (array of strings, optional): Default to empty array

#### Methods

##### process(messages)

Processes message history:

- **messages**: Array of `{ role: string, content: string }` objects

##### insertAd({ history, assistantResponse, options })

Inserts an ad into an assistant response:

- **history**: Array of message objects
- **assistantResponse**: Original assistant response string
- **options**: Optional parameter overrides

Returns a Promise that resolves with:

```javascript
{
  ad_placed: boolean,
  originalResponse: string,
  adResponse: string
}
```

## License

MIT