import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { SimulaProvider } from '../SimulaProvider';
import { RewardedMiniGame } from '../components/miniGame/RewardedMiniGame';
import { SimulaImperativeContext } from './SimulaImperativeContext';
import { ReadinessProbe } from './ReadinessProbe';
import { EventRegistry } from './events';
import {
  clampMinPlayThreshold,
  normalizeFallbackAd,
  type RewardedPreloadCache,
} from './utils';
import {
  initRewardedGame,
  fetchAdForMinigame,
} from '../utils/api';
import type {
  RewardedInitConfig,
  ImperativeShowParams,
  SimulaAdEventSubscription,
  SimulaEventHandler,
  SimulaEventType,
} from './types';

const LOAD_TIMEOUT_MS = 15000;

/**
 * Imperative wrapper over the declarative `RewardedMiniGame`.
 *
 * Same lifecycle as `SimulaMiniGameInterstitial` — see that file for the
 * full contract. The rewarded variant additionally emits `EARNED_REWARD`
 * and `REWARD_VERIFICATION_FAILED` via the component's verification
 * callbacks, and gates `LOADED` on session-ready AND a content preload
 * (rewarded init + optional fallback-ad prefetch) both settling.
 */
export class SimulaRewardedMiniGame {
  private readonly config: RewardedInitConfig;
  private readonly events: EventRegistry;

  private host: HTMLDivElement | null = null;
  private _ready: boolean = false;
  private _visible: boolean = false;
  private disposed: boolean = false;

  private _loadInFlight: Promise<void> | null = null;
  private _loadResolve: (() => void) | null = null;
  private _loadReject: ((err: Error) => void) | null = null;
  private _loadTimeout: ReturnType<typeof setTimeout> | null = null;

  // Session-ready + content-ready latches. LOADED fires only after BOTH
  // settle; either failing clears both and fires LOAD_FAILED.
  private _sessionReady: boolean = false;
  private _contentReady: boolean = false;
  private _preload: RewardedPreloadCache | null = null;
  private _preloadStarted: boolean = false;

  private _pendingShowParams: ImperativeShowParams | null = null;
  private _currentShowParams: ImperativeShowParams | null = null;
  private _showNonce: number = 0;

  private constructor(config: RewardedInitConfig) {
    this.config = {
      ...config,
      minPlayThreshold: clampMinPlayThreshold(config.minPlayThreshold),
    };
    this.events = new EventRegistry();
  }

  static init(config: RewardedInitConfig): SimulaRewardedMiniGame {
    if (!config || typeof config.apiKey !== 'string' || config.apiKey.length === 0) {
      throw new Error('[SimulaRewardedMiniGame] apiKey is required');
    }
    return new SimulaRewardedMiniGame(config);
  }

  addAdEventListener(type: SimulaEventType, handler: SimulaEventHandler): SimulaAdEventSubscription {
    return this.events.addAdEventListener(type, handler);
  }

  load(): void {
    if (this.disposed) return;
    if (this._ready || this._loadInFlight) return;

    try {
      this._ensureHost();
    } catch (err) {
      this._emitLoadFailed(err);
      return;
    }

    this._loadInFlight = new Promise<void>((resolve, reject) => {
      this._loadResolve = resolve;
      this._loadReject = reject;
    });
    this._loadInFlight.catch(() => {});

    this._loadTimeout = setTimeout(() => {
      if (this._ready || this.disposed) return;
      this._emitLoadFailed(new Error('Load timeout'));
    }, LOAD_TIMEOUT_MS);

    this._sessionReady = false;
    this._contentReady = false;
    this._preload = null;
    this._preloadStarted = false;

    this._renderTree();
  }

  show(params: ImperativeShowParams): void {
    if (this.disposed) return;
    if (!params || typeof params.charID !== 'string') {
      // eslint-disable-next-line no-console
      console.error('[SimulaRewardedMiniGame] show() requires { charID, charName, charImage }');
      return;
    }
    if (this._visible) return;

    this._pendingShowParams = params;

    if (!this._ready && !this._loadInFlight) {
      this.load();
    }

    if (this._ready) {
      this._mountVisible();
      return;
    }

    const inFlight = this._loadInFlight;
    if (inFlight) {
      inFlight
        .then(() => {
          if (this.disposed || this._visible) return;
          if (!this._pendingShowParams) return;
          this._mountVisible();
        })
        .catch(() => {
          // LOAD_FAILED already emitted.
        });
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.events.setDisposed();

    if (this._loadTimeout) {
      clearTimeout(this._loadTimeout);
      this._loadTimeout = null;
    }
    if (this._loadReject) {
      try { this._loadReject(new Error('disposed')); } catch { /* ignore */ }
    }
    this._loadResolve = null;
    this._loadReject = null;
    this._loadInFlight = null;
    this._pendingShowParams = null;
    this._currentShowParams = null;
    this._sessionReady = false;
    this._contentReady = false;
    this._preload = null;
    this._preloadStarted = false;

    if (this.host) {
      try { ReactDOM.unmountComponentAtNode(this.host); } catch { /* ignore */ }
      try {
        if (this.host.parentNode) this.host.parentNode.removeChild(this.host);
      } catch { /* ignore */ }
      this.host = null;
    }
    this._ready = false;
    this._visible = false;
  }

  // ---------- internals ----------

  private _ensureHost(): void {
    if (this.host) return;
    if (typeof document === 'undefined') {
      throw new Error('document is not available (SSR?)');
    }
    const host = document.createElement('div');
    host.setAttribute('data-simula-imperative', 'rewarded');
    host.style.display = 'none';
    document.body.appendChild(host);
    this.host = host;
  }

  private _onReady = (sessionId: string): void => {
    if (this.disposed || this._ready) return;
    this._sessionReady = true;
    this._maybeStartContentPreload(sessionId);
    this._maybeEmitLoaded();
  };

  private _maybeStartContentPreload(sessionId: string): void {
    if (this.disposed || this._preloadStarted) return;
    this._preloadStarted = true;

    const loadToken = this._loadInFlight;

    (async () => {
      try {
        // Rewarded init — preload-time call uses generic size hints
        // since no char data is available yet; the later .show() will
        // still overlay character context through component props for
        // the playing / ad / claim UI.
        const rewarded = await initRewardedGame({
          sessionId,
          w: typeof window !== 'undefined' ? window.innerWidth : 0,
          h: typeof window !== 'undefined' ? window.innerHeight : 0,
          minPlayThreshold: this.config.minPlayThreshold,
        });
        if (this.disposed || this._loadInFlight !== loadToken) return;
        if (!rewarded || !rewarded.iframe_url || !rewarded.serve_id) {
          throw new Error('initRewardedGame returned invalid payload');
        }

        // Fallback-ad prefetch — best-effort. `null` is an acceptable
        // "no ad available" settlement.
        let fallbackUrl: string | null = null;
        if (rewarded.ad_id) {
          try {
            fallbackUrl = await fetchAdForMinigame(rewarded.ad_id, sessionId);
          } catch {
            fallbackUrl = null;
          }
        }
        if (this.disposed || this._loadInFlight !== loadToken) return;

        this._preload = {
          rewarded,
          fallbackAd: normalizeFallbackAd(fallbackUrl),
        };
        this._contentReady = true;
        this._maybeEmitLoaded();
      } catch (err) {
        if (this.disposed || this._loadInFlight !== loadToken) return;
        this._emitLoadFailed(err);
      }
    })();
  }

  private _maybeEmitLoaded(): void {
    if (this.disposed || this._ready) return;
    if (!this._sessionReady || !this._contentReady) return;
    this._ready = true;
    if (this._loadTimeout) {
      clearTimeout(this._loadTimeout);
      this._loadTimeout = null;
    }
    const resolve = this._loadResolve;
    this._loadResolve = null;
    this._loadReject = null;
    this._loadInFlight = null;
    this.events.emit('LOADED', null);
    if (resolve) resolve();
  }

  private _emitLoadFailed(err: unknown): void {
    if (this._loadTimeout) {
      clearTimeout(this._loadTimeout);
      this._loadTimeout = null;
    }
    const reject = this._loadReject;
    this._loadResolve = null;
    this._loadReject = null;
    this._loadInFlight = null;
    this._pendingShowParams = null;
    this._sessionReady = false;
    this._contentReady = false;
    this._preload = null;
    this._preloadStarted = false;

    if (this.host) {
      try { ReactDOM.unmountComponentAtNode(this.host); } catch { /* ignore */ }
      try {
        if (this.host.parentNode) this.host.parentNode.removeChild(this.host);
      } catch { /* ignore */ }
      this.host = null;
    }
    this._ready = false;

    this.events.emit('LOAD_FAILED', { error: err });
    if (reject) {
      try { reject(err instanceof Error ? err : new Error(String(err))); } catch { /* ignore */ }
    }
  }

  private _onImperativeClose = (): void => {
    if (this.disposed) return;
    this._visible = false;
    this._currentShowParams = null;
    this._pendingShowParams = null;
    // Preload is single-use: clear `_ready` + caches so the next `.show()`
    // requires a fresh `.load()` — matches plan §Testing ACs
    // (re-call .load() after CLOSED starts clean and emits one fresh LOADED).
    this._ready = false;
    this._sessionReady = false;
    this._contentReady = false;
    this._preload = null;
    this._preloadStarted = false;

    if (this.host) {
      try { ReactDOM.unmountComponentAtNode(this.host); } catch { /* ignore */ }
      try {
        if (this.host.parentNode) this.host.parentNode.removeChild(this.host);
      } catch { /* ignore */ }
      this.host = null;
    }
  };

  private _onEvent = (type: SimulaEventType, payload: unknown): void => {
    this.events.emit(type, payload);
  };

  private _mountVisible(): void {
    if (this.disposed || !this.host || !this._ready) return;
    const params = this._pendingShowParams;
    if (!params) return;
    this._pendingShowParams = null;
    this._currentShowParams = params;
    this._visible = true;
    this._showNonce += 1;
    this.host.style.display = 'block';
    this._renderTree();
  }

  private _renderTree(): void {
    if (this.disposed || !this.host) return;
    const ctxValue = {
      onEvent: this._onEvent,
      onImperativeClose: this._onImperativeClose,
    };

    const children: React.ReactNode[] = [
      React.createElement(ReadinessProbe, { key: 'probe', onReady: this._onReady }),
    ];

    if (this._visible && this._currentShowParams) {
      const p = this._currentShowParams;
      const preload = this._preload;
      children.push(
        React.createElement(RewardedMiniGame, {
          key: `show-${this._showNonce}`,
          isOpen: true,
          charID: p.charID,
          charName: p.charName,
          charImage: p.charImage,
          charDesc: p.charDesc,
          messages: p.messages,
          minPlayThreshold: this.config.minPlayThreshold,
          onRewardVerified: () => {
            // Imperative wiring: emit event, then let the component's own
            // post-reward MiniGameMenu show until the user closes it.
            this.events.emit('EARNED_REWARD', null);
          },
          onRewardVerificationFailed: () => {
            this.events.emit('REWARD_VERIFICATION_FAILED', null);
          },
          _preloadedRewarded: preload?.rewarded,
          _preloadedFallbackAdUrl:
            preload?.fallbackAd.kind === 'iframe'
              ? preload.fallbackAd.iframeUrl
              : null,
        }),
      );
    }

    const innerTree = React.createElement(
      SimulaImperativeContext.Provider,
      { value: ctxValue },
      ...children,
    );

    const tree = React.createElement(
      SimulaProvider,
      {
        apiKey: this.config.apiKey,
        devMode: this.config.devMode,
        primaryUserID: this.config.primaryUserID,
        hasPrivacyConsent: this.config.hasPrivacyConsent,
        children: innerTree,
      },
    );

    // Legacy render — intentional. See plan §Architectural summary.
    // eslint-disable-next-line react/no-deprecated
    ReactDOM.render(tree, this.host);
  }
}
