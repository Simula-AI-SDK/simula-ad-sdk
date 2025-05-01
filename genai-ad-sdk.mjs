/**
 * AdInjector class for generating and inserting ads into assistant responses
 */
class AdInjector {
  /**
   * Create a new AdInjector instance
   * @param {Object} options - Configuration options
   * @param {string} options.description - Description of the app and its users (required)
   * @param {number} [options.frequency=0.5] - Float between 0 and 1 indicating ad frequency
   * @param {number} [options.fidelity=0.5] - Float between 0 and 1 indicating ad fidelity
   * @param {string[]} [options.filters=[]] - Array of filter strings
   * @param {string} [options.apiBaseUrl='http://127.0.0.1:8000'] - Base URL for the API
   */
  constructor(options = {}) {
    if (!options.description) {
      throw new Error('Description is required');
    }

    this.description = options.description;
    this.frequency = options.frequency !== undefined ? options.frequency : 0.5;
    this.fidelity = options.fidelity !== undefined ? options.fidelity : 0.5;
    this.filters = options.filters || [];
    this.apiBaseUrl = options.apiBaseUrl || "https://simula-api-701226639755.us-central1.run.app/" // 'http://127.0.0.1:8000';

    // Instance variables for ad frequency
    this.msgCount = 0;
    this.insertionSteps = [];
    this.numInsertionSteps = this.frequency * 100;
    this.#populateInsertionSteps();

    // Validate frequency and fidelity are within 0-1
    if (this.frequency < 0 || this.frequency > 1) {
      throw new Error('Frequency must be between 0 and 1');
    }
    if (this.fidelity < 0 || this.fidelity > 1) {
      throw new Error('Fidelity must be between 0 and 1');
    }
  }

  /**
   * Populate array of insertion steps based on frequency
   */
  #populateInsertionSteps() {
    for (let i = 0; i < 100; i++) {
      this.insertionSteps.push(0);
    }
    for (let i = 0; i < this.numInsertionSteps; i++) {
      let idx = Math.floor(Math.random() * 100).toFixed();
      while (this.insertionSteps[idx] == 1) {
        idx = Math.floor(Math.random() * 100);
      }
      this.insertionSteps[idx] = 1;
    }
  }

  /**
   * Determines whether we should insert an ad based on the given frequency
   * @returns True if ad should be inserted, False otherwise
   */
  #shouldInsertAdFreq() {
    if (this.insertionSteps[this.msgCount % 100] == 1) {
      this.msgCount++;
      return true;
    } else {
      return false;
    }
  }

  /**
   * Process message history and get user profile
   * @param {Array<Object>} messages - Array of message objects
   * @param {string} messages[].role - Role (system, user, assistant)
   * @param {string} messages[].content - Message content
   * @returns {Promise<Object>} - Promise resolving to user profile
   */
  async process(messages) {
    try {
      // Convert messages to conversation history string
      const convHistory = messages.map(msg => 
        `${msg.role}: ${msg.content}`
      ).join('\n');

      const response = await fetch(`${this.apiBaseUrl}/user_profile/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ conv_history: convHistory })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const userProfile = await response.json();
      return userProfile;
    } catch (error) {
      console.error('Error processing user profile:', error);
      throw error;
    }
  }

  /**
   * Insert ad from SSE stream into assistant response
   * @param {Object} params - Parameters
   * @param {Array<Object>} params.history - Message history
   * @param {string} params.assistantResponse - Original assistant response
   * @param {Object} [params.options] - Optional overrides. Q: do we really need these?
   * @returns {Promise<Object>} - Promise resolving to result with ad
   */
  async *insertAd({ history, assistantResponse, options = {} }) { // Generator fctn
    try {
      // Convert messages to conversation history string
      const convHistory = history.map(msg => 
        `${msg.role}: ${msg.content}`
      ).join('\n');

      // Check whether we should insert ad based on frequency
      if (this.#shouldInsertAdFreq()) {
        const response = await fetch(`${this.apiBaseUrl}/ad_integrate/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            conv_history: convHistory,
            llm_response: assistantResponse,
            fidelity: options.fidelity || this.fidelity,
            description: options.description || this.description,
            filters: options.filters || this.filters,
          })
        });
  
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
  
        // Handle SSE Stream
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
  
        while (true) {
          const {value, done} = await reader.read();
          if (done) {
            break;
          }
          const chunk = decoder.decode(value, { stream: true });
          const cleanChunk = chunk.substring(6).replace(" ", "")
          yield cleanChunk;
        }
      } else {
        console.log("Ad not inserted b/c of frequency.");
        const chunkedResponse = assistantResponse.split(" ");
        for (let chunk of chunkedResponse){ // Stream assistant response back
          yield chunk;
        }
      }

    } catch (error) {
      console.error('Error inserting ad:', error);
      throw error;
    }
  }
}

// Use ES Module export syntax
export { AdInjector }; 