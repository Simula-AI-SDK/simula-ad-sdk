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

export const SimulaProvider: React.FC<SimulaProviderProps> = ({ apiKey, children }) => {
  if (!apiKey) {
    throw new Error('SimulaProvider requires an apiKey prop');
  }

  const value: SimulaContextValue = {
    apiKey,
  };

  return (
    <SimulaContext.Provider value={value}>
      {children}
    </SimulaContext.Provider>
  );
};