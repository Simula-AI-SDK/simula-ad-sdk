/**
 * GenAI Ad SDK - A module for injecting ads into AI assistant responses
 * @module genai-ad-sdk
 */

const { AdInjector, trackClick } = require('./genai-ad-sdk');

// Re-export the AdInjector class
module.exports = { AdInjector, trackClick }; 