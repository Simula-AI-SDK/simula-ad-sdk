import React, { createContext, useContext, useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { SimulaProviderProps, SimulaContextValue, AdData } from './types';
import { createSession, updateSessionPpid } from './utils/api';
import { validateSimulaProviderProps } from './utils/validation';

const SimulaContext = createContext<SimulaContextValue | undefined>(undefined);

// Helper to create cache key from slot and position
const getCacheKey = (slot: string, position: number): string => `${slot}:${position}`;

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
    primaryUserID,
    hasPrivacyConsent = true,
  } = props;
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);

  // Ad caching infrastructure (matching Flutter SDK)
  const adCacheRef = useRef<Map<string, AdData>>(new Map());
  const heightCacheRef = useRef<Map<string, number>>(new Map());
  const noFillSetRef = useRef<Set<string>>(new Set());

  // Track previous primaryUserID for change detection
  const prevPrimaryUserIDRef = useRef<string | undefined>(primaryUserID);

  // Effect 1: Create session on mount (or when apiKey/devMode change)
  useEffect(() => {
    let cancelled = false;

    async function ensureSession() {
      const effectiveUserID = hasPrivacyConsent ? primaryUserID : undefined;
      const id = await createSession(apiKey, devMode, effectiveUserID);
      if (!cancelled && id) {
        setSessionId(id);
      }
    }

    ensureSession();
    return () => { cancelled = true; };
  }, [apiKey, devMode]);

  // Effect 2: PATCH existing session when primaryUserID changes
  useEffect(() => {
    const effectiveUserID = hasPrivacyConsent ? primaryUserID : undefined;
    const prev = prevPrimaryUserIDRef.current;
    prevPrimaryUserIDRef.current = primaryUserID;

    // Skip if no session yet, value hasn't actually changed, or no consent/value
    if (!sessionId || effectiveUserID === prev || !effectiveUserID) return;

    updateSessionPpid(sessionId, effectiveUserID).catch((err) => {
      console.error('Failed to update session PPID:', err);
    });
  }, [primaryUserID, hasPrivacyConsent, sessionId]);

  // Cache management functions
  const getCachedAd = useCallback((slot: string, position: number): AdData | null => {
    const key = getCacheKey(slot, position);
    return adCacheRef.current.get(key) ?? null;
  }, []);

  const cacheAd = useCallback((slot: string, position: number, ad: AdData): void => {
    const key = getCacheKey(slot, position);
    adCacheRef.current.set(key, ad);
  }, []);

  const getCachedHeight = useCallback((slot: string, position: number): number | null => {
    const key = getCacheKey(slot, position);
    return heightCacheRef.current.get(key) ?? null;
  }, []);

  const cacheHeight = useCallback((slot: string, position: number, height: number): void => {
    const key = getCacheKey(slot, position);
    heightCacheRef.current.set(key, height);
  }, []);

  const hasNoFill = useCallback((slot: string, position: number): boolean => {
    const key = getCacheKey(slot, position);
    return noFillSetRef.current.has(key);
  }, []);

  const markNoFill = useCallback((slot: string, position: number): void => {
    const key = getCacheKey(slot, position);
    noFillSetRef.current.add(key);
  }, []);

  // Memoize context value to prevent unnecessary re-renders
  const value: SimulaContextValue = useMemo(() => ({
    apiKey,
    devMode,
    sessionId,
    hasPrivacyConsent,
    getCachedAd,
    cacheAd,
    getCachedHeight,
    cacheHeight,
    hasNoFill,
    markNoFill,
  }), [apiKey, devMode, sessionId, hasPrivacyConsent, getCachedAd, cacheAd, getCachedHeight, cacheHeight, hasNoFill, markNoFill]);

  return (
    <SimulaContext.Provider value={value}>
      {children}
    </SimulaContext.Provider>
  );
};