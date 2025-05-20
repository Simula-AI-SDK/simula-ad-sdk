declare module 'simula-ad' {
  export class AdInjector {
    /**
     * Create a new AdInjector instance
     * @param options - Configuration options
     */
    constructor(options: {
      description: string;
      frequency?: number;
      fidelity?: number;
      filters?: string[];
      apiBaseUrl?: string;
    });

    static init(options: {
      description: string;
      frequency?: number;
      fidelity?: number;
      filters?: string[];
      apiBaseUrl?: string;
    }): Promise<AdInjector>;

    /**
     * Process message history and get user profile
     * @param messages - Array of message objects
     * @returns Promise resolving to user profile
     */
    process(messages: Array<{ role: string; content: string }>): Promise<any>;

    /**
     * Insert ad from SSE stream into assistant response
     * @param params - Parameters
     * @returns AsyncIterable of string chunks
     */
    insertAd(params: {
      history: Array<{ role: string; content: string }>;
      assistantResponse: string;
      options?: {
        fidelity?: number;
        description?: string;
        filters?: string[];
      };
    }): AsyncIterable<string>;
  }

  export function trackClick(id: string, clickTime: string): Promise<void>
} 