import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
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
  const callIdRef = useRef(0);

  useEffect(() => {
    const currentCallId = ++callIdRef.current;

    async function ensureSession() {
      const id = await createSession(apiKey, devMode, primaryUserID);
      // Allow override: only update if this is still the latest call
      // This ensures the most recent session creation always wins
      if (currentCallId === callIdRef.current && id) {
        setSessionId(id);
      }
    }

    ensureSession();
  }, [apiKey, devMode, primaryUserID]);

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