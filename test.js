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
  { role: 'user', content: 'Dang, I really wanted to get some sun to improve my skin. Tell me a joke instead.' }
];

// Sample assistant response
const sampleResponse = 'Why did the chicken cross the road? To get to the other side!';

// Main test function
async function runTests() {
  try {

    const adInjector = await AdInjector.init(
      {
        description: 'A weather app used by outdoor enthusiasts',
        frequency: 0.7,
        fidelity: 0.3,
        filters: ['inappropriate', 'competing-products'],
        apiBaseUrl: "https://simula-api-701226639755.us-central1.run.app/" // 'http://127.0.0.1:8000'
      }
    )

    // Test the insertAd method
    console.log('\n--- Testing insertAd method (ad_integrate endpoint) ---');
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

    // TODO: add back test case w/ minimal options here

  } catch (error) {
    console.error('Test Error:', error);
  }
}

// Run the tests
runTests(); 