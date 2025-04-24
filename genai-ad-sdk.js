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
    this.apiBaseUrl = options.apiBaseUrl || 'http://127.0.0.1:8000';

    // Validate frequency and fidelity are within 0-1
    if (this.frequency < 0 || this.frequency > 1) {
      throw new Error('Frequency must be between 0 and 1');
    }
    if (this.fidelity < 0 || this.fidelity > 1) {
      throw new Error('Fidelity must be between 0 and 1');
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
   * @param {Object} [params.options] - Optional overrides
   * @returns {Promise<Object>} - Promise resolving to result with ad
   */
  async *insertAd({ history, assistantResponse, options = {} }) { // Generator fctn
    try {
      // Convert messages to conversation history string
      const convHistory = history.map(msg => 
        `${msg.role}: ${msg.content}`
      ).join('\n');

      const response = await fetch(`${this.apiBaseUrl}/ad_integrate/ete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conv_history: convHistory,
          llm_response: assistantResponse
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
        yield chunk;
      }

    } catch (error) {
      console.error('Error inserting ad:', error);
      throw error;
    }
  }
}

// CommonJS export
module.exports = { AdInjector }; 