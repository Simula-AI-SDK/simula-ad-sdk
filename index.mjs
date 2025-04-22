/**
 * GenAI Ad SDK - A module for injecting ads into AI assistant responses (ESM version)
 * @module genai-ad-sdk
 */

import { AdInjector as CommonJSAdInjector } from './genai-ad-sdk.js';

// Re-export the AdInjector class for ESM
export const AdInjector = CommonJSAdInjector; 