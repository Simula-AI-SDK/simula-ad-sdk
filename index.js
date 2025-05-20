/**
 * Simula Ad SDK - A module for injecting ads into AI assistant responses
 * @module simula-ad-sdk
 */

const { AdInjector, trackClick } = require('./simula-ad');

// Re-export the AdInjector class
module.exports = { AdInjector, trackClick }; 