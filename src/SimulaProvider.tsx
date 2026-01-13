import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { SimulaProviderProps, SimulaContextValue } from './types';
import { createSession } from './utils/api';
import { validateSimulaProviderProps } from './utils/validation';

const SimulaContext = createContext<SimulaContextValue | undefined>(undefined);

export const useSimula = (): SimulaContextValue => {
  const context = useContext(SimulaContext);
  if (!context) {
    throw new Error('useSimula must be used within a SimulaProvider');
  }
  return context;
};

export const SimulaProvider: React.FC<SimulaProviderProps> = (props) => {
  // Validate props early
  validateSimulaProviderProps(props);

  const {
    apiKey,
    children,
    devMode = false,
    primaryUserID
  } = props;
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    async function ensureSession() {
      console.log('[SimulaProvider] Creating session with:', { apiKey: apiKey?.substring(0, 10) + '...', devMode, primaryUserID });
      const id = await createSession(apiKey, devMode, primaryUserID);
      if (!cancelled && id) {
        console.log('[SimulaProvider] Session created and set:', id);
        setSessionId(id);
      } else if (cancelled) {
        console.log('[SimulaProvider] Session creation cancelled');
      } else {
        console.warn('[SimulaProvider] Session creation returned undefined');
      }
    }

    ensureSession();
    return () => { 
      console.log('[SimulaProvider] Cleaning up session creation');
      cancelled = true; 
    };
  }, [apiKey, devMode, primaryUserID]);

  // Memoize context value to prevent unnecessary re-renders
  const value: SimulaContextValue = useMemo(() => ({
    apiKey,
    devMode,
    sessionId,
  }), [apiKey, devMode, sessionId]);

  // Log when sessionId changes
  useEffect(() => {
    if (sessionId) {
      console.log('[SimulaProvider] Context sessionId updated to:', sessionId);
    }
  }, [sessionId]);

  return (
    <SimulaContext.Provider value={value}>
      {children}
    </SimulaContext.Provider>
  );
};