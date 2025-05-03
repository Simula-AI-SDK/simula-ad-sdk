/**
 * Example usage of the Simula Ad SDK
 */

// Import the AdInjector class
const { AdInjector } = require('./index');

// Sample chat history
const sampleHistory = [
  { role: 'system', content: 'You are a helpful assistant.' },
  { role: 'user', content: 'What is the weather today?' },
  { role: 'assistant', content: 'I cannot access real-time weather data.' },
  { role: 'user', content: 'Dang, I really wanted to get some sun to improve my skin. Tell me a joke instead.' }
];

// Sample assistant response
const sampleResponse = 'Why did the chicken cross the road? To get to the other side!';

// Create an instance of AdInjector
const adInjector = new AdInjector({
  description: 'A weather app used by outdoor enthusiasts',
  frequency: 0.7,
  fidelity: 0.3,
  filters: ['inappropriate', 'competing-products'],
  apiBaseUrl: "https://simula-api-701226639755.us-central1.run.app/" // 'http://127.0.0.1:8000'
});

// Main test function
async function runTests() {
  try {
    // Test the process method
    console.log('\n--- Testing process method (user_profile endpoint) ---');
    const userProfile = await adInjector.process(sampleHistory);
    console.log('User Profile Response:');
    console.log(JSON.stringify(userProfile, null, 2));

    // Test the insertAd method
    console.log('\n--- Testing insertAd method (ad_integrate/ete endpoint) ---');
    console.log('\nAd Integration Response:');
    for await (
      const chunk of adInjector.insertAd(
        { 
          history: sampleHistory,
          assistantResponse: sampleResponse
        }
      )
    ){
      console.log(chunk);
    }

    // Example with minimal options
    console.log('\n--- Testing with minimal options ---');
    const minimalAdInjector = new AdInjector({
      description: 'A simple chat application',
      apiBaseUrl: 'https://simula-api-701226639755.us-central1.run.app'
    });

    console.log('\nMinimal Configuration Response:');
    for await (
      const chunk of minimalAdInjector.insertAd(
        { 
          history: sampleHistory,
          assistantResponse: sampleResponse,
        }
      )
    ){
      console.log(chunk);
    }

  } catch (error) {
    console.error('Test Error:', error);
  }
}

// Run the tests
runTests(); 