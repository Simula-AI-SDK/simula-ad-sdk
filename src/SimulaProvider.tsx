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
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    async function ensureSession() {
      const id = await createSession(apiKey, devMode);
      if (!cancelled && id) setSessionId(id);
    }

    ensureSession();
    return () => { cancelled = true; };
  }, [apiKey, devMode]);

  const value: SimulaContextValue = {
    apiKey,
    devMode,
    sessionId,
  };

  return (
    <SimulaContext.Provider value={value}>
      {children}
    </SimulaContext.Provider>
  );
};