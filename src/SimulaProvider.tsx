import React, { createContext, useContext, useEffect, useState } from 'react';
import { SimulaProviderProps, SimulaContextValue } from './types';
import { createSession } from './utils/api';

const SimulaContext = createContext<SimulaContextValue | undefined>(undefined);

export const useSimula = (): SimulaContextValue => {
  const context = useContext(SimulaContext);
  if (!context) {
    throw new Error('useSimula must be used within a SimulaProvider');
  }
  return context;
};

export const SimulaProvider: React.FC<SimulaProviderProps> = ({ 
  apiKey, 
  children, 
  devMode = false
}) => {
  if (!apiKey && !devMode) {
    throw new Error('SimulaProvider requires an apiKey prop (or set devMode=true for testing)');
  }

  const [sessionId, setSessionId] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    async function ensureSession() {
      if (devMode) return;
      const id = await createSession(apiKey);
      if (!cancelled && id) setSessionId(id);
    }

    ensureSession();
    return () => { cancelled = true; };
  }, [apiKey, devMode]);

  const value: SimulaContextValue = {
    apiKey: apiKey || 'dev-mode-key',
    devMode,
    sessionId,
  };

  return (
    <SimulaContext.Provider value={value}>
      {children}
    </SimulaContext.Provider>
  );
};