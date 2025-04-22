/**
 * Example usage of the GenAI Ad SDK
 */

// Import the AdInjector class
const { AdInjector } = require('./index');

// Sample chat history
const sampleHistory = [
  { role: 'system', content: 'You are a helpful assistant.' },
  { role: 'user', content: 'What is the weather today?' },
  { role: 'assistant', content: 'I cannot access real-time weather data.' },
  { role: 'user', content: 'Tell me a joke instead.' }
];

// Sample assistant response
const sampleResponse = 'Why did the chicken cross the road? To get to the other side!';

// Create an instance of AdInjector
const adInjector = new AdInjector({
  description: 'A weather app used by outdoor enthusiasts',
  frequency: 0.7,
  fidelity: 0.3,
  filters: ['inappropriate', 'competing-products']
});

// Test the process method
console.log('\n--- Testing process method ---');
adInjector.process(sampleHistory);

// Test the insertAd method
console.log('\n--- Testing insertAd method ---');
adInjector.insertAd({
  history: sampleHistory,
  assistantResponse: sampleResponse,
  options: {
    priority: 'high',
    category: 'outdoor-gear'
  }
})
.then(result => {
  console.log('\nResult from insertAd:');
  console.log(result);
})
.catch(error => {
  console.error('Error:', error);
});

// Example with minimal options
console.log('\n--- Testing with minimal options ---');
const minimalAdInjector = new AdInjector({
  description: 'A simple chat application'
});

minimalAdInjector.insertAd({
  history: sampleHistory,
  assistantResponse: 'Hello, how can I help you today?'
})
.then(result => {
  console.log('\nResult from minimal configuration:');
  console.log(result);
})
.catch(error => {
  console.error('Error:', error);
}); 