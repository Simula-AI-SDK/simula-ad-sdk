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
   */
  constructor(options = {}) {
    if (!options.description) {
      throw new Error('Description is required');
    }

    this.description = options.description;
    this.frequency = options.frequency !== undefined ? options.frequency : 0.5;
    this.fidelity = options.fidelity !== undefined ? options.fidelity : 0.5;
    this.filters = options.filters || [];

    // Validate frequency and fidelity are within 0-1
    if (this.frequency < 0 || this.frequency > 1) {
      throw new Error('Frequency must be between 0 and 1');
    }
    if (this.fidelity < 0 || this.fidelity > 1) {
      throw new Error('Fidelity must be between 0 and 1');
    }
  }

  /**
   * Process message history
   * @param {Array<Object>} messages - Array of message objects
   * @param {string} messages[].role - Role (system, user, assistant)
   * @param {string} messages[].content - Message content
   */
  process(messages) {
    console.log('Processing history:', messages);
    return messages;
  }

  /**
   * Insert ad into assistant response
   * @param {Object} params - Parameters
   * @param {Array<Object>} params.history - Message history
   * @param {string} params.assistantResponse - Original assistant response
   * @param {Object} [params.options] - Optional overrides
   * @returns {Promise<Object>} - Promise resolving to result with ad
   */
  insertAd({ history, assistantResponse, options = {} }) {
    console.log('Insert ad parameters:', {
      historyLength: history?.length,
      responsePreview: assistantResponse?.substring(0, 50) + '...',
      options
    });

    return Promise.resolve({
      ad_placed: true,
      originalResponse: assistantResponse,
      adResponse: assistantResponse + " [Sample Ad Inserted]"
    });
  }
}

// CommonJS export
module.exports = { AdInjector }; 