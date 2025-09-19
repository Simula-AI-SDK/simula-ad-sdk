import React, { createContext, useContext } from 'react';
import { SimulaProviderProps, SimulaContextValue } from './types';

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

  const value: SimulaContextValue = {
    apiKey: apiKey || 'dev-mode-key',
    devMode,
  };

  return (
    <SimulaContext.Provider value={value}>
      {children}
    </SimulaContext.Provider>
  );
};