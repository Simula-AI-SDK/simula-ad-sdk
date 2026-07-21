import React, { createContext, useContext, useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { SimulaProviderProps, SimulaContextValue, AdData } from './types';
import { fetchAditudeConfig } from './utils/api';
import { validateSimulaProviderProps } from './utils/validation';
import { logger, setDebugMode } from './utils/logger';
import { SimulaAds } from './core/SimulaAds';
import { SessionManager } from './core/session';

const SimulaContext = createContext<SimulaContextValue | undefined>(undefined);

// Helper to create cache key from slot and position
const getCacheKey = (slot: string, position: number): string => `${slot}:${position}`;

// Inert context returned when useSimula is consumed outside a SimulaProvider.
// The SDK renders blank instead of crashing the host app (native prime
// directive: degrade to blank UI, never throw into host code).
const INERT_CONTEXT: SimulaContextValue = {
  apiKey: '',
  devMode: false,
  sessionId: undefined,
  hasPrivacyConsent: false,
  getCachedAd: () => null,
  cacheAd: () => {},
  getCachedHeight: () => null,
  cacheHeight: () => {},
  hasNoFill: () => false,
  markNoFill: () => {},
  aditudeReady: false,
  aditudeConfig: undefined,
};

let warnedOutsideProvider = false;

export const useSimula = (): SimulaContextValue => {
  const context = useContext(SimulaContext);
  if (!context) {
    if (!warnedOutsideProvider) {
      warnedOutsideProvider = true;
      logger.warn(
        'useSimula was used outside a <SimulaProvider> — Simula ad surfaces will render blank. ' +
        'Wrap your app in <SimulaProvider> or call SimulaAds.initialize first.'
      );
    }
    return INERT_CONTEXT;
  }
  return context;
};

export const SimulaProvider: React.FC<SimulaProviderProps> = (props) => {
  // Validate props on EVERY render: validation is cheap (small prop objects)
  // and each unique failure logs only once, so a provider mounted with
  // temporarily-invalid props recovers when they become valid (strict mode —
  // devMode — throws during integration).
  const propsValid = validateSimulaProviderProps(props, props.devMode === true);

  const {
    apiKey,
    children,
    devMode = false,
    primaryUserID,
    hasPrivacyConsent = true,
    privacy,
    telemetryEnabled,
  } = props;
  const [sessionId, setSessionId] = useState<string | undefined>(() => SimulaAds.getSessionId());

  // aditude
  const [aditudeReady, setAditudeReady] = useState<boolean>(false);
  const [aditudeConfig, setAditudeConfig] = useState<import('./types').AditudeConfig | undefined>(undefined);

  // Ad caching infrastructure (matching Flutter SDK)
  const adCacheRef = useRef<Map<string, AdData>>(new Map());
  const heightCacheRef = useRef<Map<string, number>>(new Map());
  const noFillSetRef = useRef<Set<string>>(new Set());

  // Sync logger verbosity with devMode so internal debug logs only appear
  // when the publisher has explicitly opted in via <SimulaProvider devMode>.
  useEffect(() => {
    setDebugMode(devMode);
  }, [devMode]);

  // Initialize the SDK core. First valid call wins — this is a no-op when
  // the host already called SimulaAds.initialize imperatively (both entry
  // points share the same core, mirroring the native SDKs).
  useEffect(() => {
    if (!propsValid) return;
    SimulaAds.initialize({ apiKey, devMode, primaryUserID, hasPrivacyConsent, privacy, telemetryEnabled });
    setSessionId(SessionManager.getSessionId());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, devMode, propsValid]);

  // Keep runtime identity props in sync: mid-session login/logout/switch
  // (PPID reconcile) and consent flips, serialized inside the core.
  useEffect(() => {
    if (!propsValid || !SimulaAds.isInitialized()) return;
    SimulaAds._syncIdentity(primaryUserID, hasPrivacyConsent);
  }, [primaryUserID, hasPrivacyConsent, propsValid]);

  // Subscribe to the shared session lifecycle
  useEffect(() => SessionManager.subscribe(setSessionId), []);

  // Effect 3: Fetch Aditude config from API (skip in devMode).
  //
  // We no longer inject Aditude scripts into the publisher's page — the
  // WidgetShell iframe owns the Aditude Cloud Wrapper inside its own
  // document, which is what the shell route serves. The publisher's
  // window.tude is never touched. All we need on the SDK side is the
  // "is this domain Aditude-enabled?" gate for deciding whether to render
  // WidgetShell medrecs at all.
  useEffect(() => {
    if (devMode) return;

    let cancelled = false;

    async function loadAditudeConfig() {
      try {
        const domain = window.location.hostname;
        const config = await fetchAditudeConfig(domain);

        if (cancelled || !config || !config.enabled) return;

        setAditudeConfig(config);
        setAditudeReady(true);
      } catch {
        // Silently disable Aditude — existing SDK behavior unchanged
      }
    }

    loadAditudeConfig();
    return () => { cancelled = true; };
  }, [devMode])

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
    aditudeConfig,
    aditudeReady,
  }), [apiKey, devMode, sessionId, hasPrivacyConsent, getCachedAd, cacheAd, getCachedHeight, cacheHeight, hasNoFill, markNoFill]);

  return (
    <SimulaContext.Provider value={value}>
      {children}
    </SimulaContext.Provider>
  );
};
