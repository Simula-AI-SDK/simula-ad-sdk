import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { SimulaProvider } from '../SimulaProvider';
import { MiniGameInterstitial } from '../components/miniGame/MiniGameInterstitial';
import { MiniGameMenu } from '../components/miniGame/MiniGameMenu';
import { SimulaImperativeContext } from './SimulaImperativeContext';
import { ReadinessProbe } from './ReadinessProbe';
import { EventRegistry } from './events';
import {
  clampMinPlayThreshold,
  selectSponsoredGame,
  normalizeFallbackAd,
  type InterstitialPreloadCache,
} from './utils';
import {
  fetchCatalog,
  getMinigame,
  fetchAdForMinigame,
} from '../utils/api';
import type {
  InterstitialInitConfig,
  ImperativeShowParams,
  SimulaAdEventSubscription,
  SimulaEventHandler,
  SimulaEventType,
} from './types';

const LOAD_TIMEOUT_MS = 15000;

type Phase = 'interstitial' | 'game';

/**
 * Imperative wrapper over the declarative interstitial + full-game flow.
 *
 * Lifecycle:
 *  - `.init(config)` constructs the manager (static factory).
 *  - `.load()` creates a hidden DOM host, mounts a private SimulaProvider
 *    tree via legacy `ReactDOM.render`, waits for both ReadinessProbe
 *    (session-ready) AND a content preload stage (catalog → sponsored-game
 *    selection → getMinigame bootstrap → fallback-ad prefetch) to settle
 *    before emitting `LOADED`. Idempotent.
 *  - `.show(params)` flips the host visible and transitions through two
 *    phases: `interstitial` (fullscreen CTA card) → `game` (MiniGameMenu
 *    preloaded directly into the sponsored game, never shows the grid).
 *    The legacy `fullInvitation` interstitial-modal phase has been
 *    collapsed out of the imperative happy path per proposal #19.
 *  - CTA on the fullscreen interstitial emits `CLICKED` and advances
 *    directly to `game`. It does NOT emit `CLOSED` and does NOT teardown.
 *  - Explicit dismiss paths (X, ESC) emit `CLOSED` (from the declarative
 *    component) and tear down the visible tree.
 *  - Terminal close from the game/ad flow emits `CLOSED` exactly once
 *    BEFORE teardown so consumers can leave their local `showing` state
 *    and relaunch.
 *  - `DISPLAY_FAILED` path emits `DISPLAY_FAILED` once and tears down
 *    WITHOUT a second `CLOSED`.
 *  - `.dispose()` unmounts + removes the host, clears timers + promise
 *    refs + cached preload payload so a later `.load()` starts clean.
 */
export class SimulaMiniGameInterstitial {
  private readonly config: InterstitialInitConfig;
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
  private _preload: InterstitialPreloadCache | null = null;
  // Tracks whether an in-flight content preload has been started so a
  // duplicate ReadinessProbe fire (unlikely, but defensive) doesn't kick
  // off a second pipeline.
  private _preloadStarted: boolean = false;

  private _pendingShowParams: ImperativeShowParams | null = null;
  private _currentShowParams: ImperativeShowParams | null = null;
  private _showNonce: number = 0;
  private _phase: Phase = 'interstitial';
  // DISPLAY_FAILED fires at most once per show cycle.
  private _displayFailedFired: boolean = false;

  private constructor(config: InterstitialInitConfig) {
    this.config = {
      ...config,
      minPlayThreshold: clampMinPlayThreshold(config.minPlayThreshold),
      delegateChar: config.delegateChar ?? true,
    };
    this.events = new EventRegistry();
  }

  static init(config: InterstitialInitConfig): SimulaMiniGameInterstitial {
    if (!config || typeof config.apiKey !== 'string' || config.apiKey.length === 0) {
      throw new Error('[SimulaMiniGameInterstitial] apiKey is required');
    }
    return new SimulaMiniGameInterstitial(config);
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
    // Swallow rejection here; consumers observe failure via events, not the
    // promise. Show-path chaining below handles pending-show cleanup.
    this._loadInFlight.catch(() => {});

    this._loadTimeout = setTimeout(() => {
      if (this._ready || this.disposed) return;
      this._emitLoadFailed(new Error('Load timeout'));
    }, LOAD_TIMEOUT_MS);

    this._sessionReady = false;
    this._contentReady = false;
    this._preloadStarted = false;
    this._preload = null;

    this._renderTree();
  }

  show(params: ImperativeShowParams): void {
    if (this.disposed) return;
    if (!params || typeof params.charID !== 'string') {
      // eslint-disable-next-line no-console
      console.error('[SimulaMiniGameInterstitial] show() requires { charID, charName, charImage }');
      return;
    }
    if (this._visible) return; // No-op while visible.

    this._pendingShowParams = params;

    if (!this._ready && !this._loadInFlight) {
      // Lazy load triggered by show().
      this.load();
    }

    if (this._ready) {
      this._mountVisible();
      return;
    }

    // Wait for load.
    const inFlight = this._loadInFlight;
    if (inFlight) {
      inFlight
        .then(() => {
          if (this.disposed || this._visible) return;
          if (!this._pendingShowParams) return;
          this._mountVisible();
        })
        .catch(() => {
          // LOAD_FAILED already emitted; pending cleared there.
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
    this._displayFailedFired = false;

    if (this.host) {
      try { ReactDOM.unmountComponentAtNode(this.host); } catch { /* ignore */ }
      try {
        if (this.host.parentNode) this.host.parentNode.removeChild(this.host);
      } catch { /* ignore */ }
      this.host = null;
    }
    this._ready = false;
    this._visible = false;
    this._phase = 'interstitial';
  }

  // ---------- internals ----------

  private _ensureHost(): void {
    if (this.host) return;
    if (typeof document === 'undefined') {
      throw new Error('document is not available (SSR?)');
    }
    const host = document.createElement('div');
    host.setAttribute('data-simula-imperative', 'interstitial');
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

    // Capture the load in-flight promise identity; if a dispose or
    // LOAD_FAILED nulls `_loadInFlight` or rotates it, we must NOT commit
    // stale preload payloads onto the instance.
    const loadToken = this._loadInFlight;

    (async () => {
      try {
        const catalog = await fetchCatalog();
        if (this.disposed || this._loadInFlight !== loadToken) return;

        const selectedGame = selectSponsoredGame(catalog.games);
        if (!selectedGame) {
          throw new Error('No sponsored game available in catalog');
        }

        const minigame = await getMinigame({
          gameType: selectedGame.id,
          sessionId,
          currencyMode: false,
          w: typeof window !== 'undefined' ? window.innerWidth : 0,
          h: typeof window !== 'undefined' ? window.innerHeight : 0,
          delegate_char: this.config.delegateChar ?? true,
          menuId: catalog.menuId || undefined,
        });
        if (this.disposed || this._loadInFlight !== loadToken) return;
        if (!minigame || !minigame.adResponse || !minigame.adResponse.iframe_url) {
          throw new Error('getMinigame returned no iframe_url');
        }

        // Fallback-ad prefetch — best-effort. `null` is an acceptable
        // "no ad available" settlement; we represent it as `{ kind: 'none' }`
        // rather than failing the preload.
        const adId = minigame.adResponse.ad_id;
        let fallbackUrl: string | null = null;
        if (adId) {
          try {
            fallbackUrl = await fetchAdForMinigame(adId, sessionId);
          } catch {
            fallbackUrl = null;
          }
        }
        if (this.disposed || this._loadInFlight !== loadToken) return;

        this._preload = {
          catalog: catalog.games,
          menuId: catalog.menuId || null,
          selectedGame,
          minigame,
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

    // Tear down hidden host so a subsequent .load() can start clean.
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

  /**
   * Normal terminal close from the playable game/ad flow. Emits SDK
   * `CLOSED` exactly once BEFORE running the standard teardown so that
   * consumers (e.g. `dippy-ai-mock/src/pages/CharacterPage.tsx`) can
   * leave their local `showing` state and relaunch via the trigger.
   *
   * `DISPLAY_FAILED` does NOT route through here — see `_onEvent`,
   * which emits `DISPLAY_FAILED` once and then calls the bare
   * `_onImperativeClose` teardown without a second `CLOSED`.
   */
  private _closeFromTerminalGame = (): void => {
    if (this.disposed) return;
    if (!this._visible) return;
    // Emit CLOSED first, while internal state still reflects the
    // visible-game session — teardown clears `_visible` / `_ready` /
    // `_preload` / phase / host / show params right after.
    this.events.emit('CLOSED', null);
    this._onImperativeClose();
  };

  private _onImperativeClose = (): void => {
    // Declarative component requested teardown (X / ESC /
    // terminal game+ad close / DISPLAY_FAILED). This method is the
    // bare teardown — it does NOT emit any SDK event itself. Callers
    // that need to emit `CLOSED` (the X/ESC path inside
    // MiniGameInterstitial.tsx, and `_closeFromTerminalGame` above)
    // are responsible for emitting BEFORE invoking this teardown.
    if (this.disposed) return;
    this._visible = false;
    this._currentShowParams = null;
    this._pendingShowParams = null;
    this._phase = 'interstitial';
    this._displayFailedFired = false;
    // Preload is single-use: a fresh LOADED cycle must start clean.
    // Clear `_ready` + preload caches so the next `.show()` requires a
    // fresh `.load()` — matches plan §Testing ACs.
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

  private _onImperativeAdvance = (token: string): void => {
    if (this.disposed) return;
    if (!this._visible) return;
    if (token === 'interstitial:cta' && this._phase === 'interstitial') {
      // Per proposal #19: collapse the interstitial:cta CTA path so it
      // goes directly from `interstitial` to `game`, skipping the
      // legacy `fullInvitation` modal.
      this._phase = 'game';
      this._showNonce += 1;
      this._renderTree();
      return;
    }
    // Unknown token or unexpected phase — ignore. The legacy
    // `fullInvitation:accept` token is no longer reachable in the
    // imperative happy path.
  };

  private _onEvent = (type: SimulaEventType, payload: unknown): void => {
    // GameIframe forwards DISPLAY_FAILED via the imperative context on mount
    // failure. Dedupe + auto-teardown here so callers only ever see ONE
    // DISPLAY_FAILED per show, and so CLOSED is NOT also emitted for the
    // same failure per plan §Edge cases.
    if (type === 'DISPLAY_FAILED') {
      if (this._displayFailedFired) return;
      this._displayFailedFired = true;
      this.events.emit('DISPLAY_FAILED', payload);
      // Tear down the visible tree; do NOT emit CLOSED.
      this._onImperativeClose();
      return;
    }
    this.events.emit(type, payload);
  };

  private _mountVisible(): void {
    if (this.disposed || !this.host || !this._ready) return;
    const params = this._pendingShowParams;
    if (!params) return;
    this._pendingShowParams = null;
    this._currentShowParams = params;
    this._visible = true;
    this._phase = 'interstitial';
    this._displayFailedFired = false;
    this._showNonce += 1;
    this.host.style.display = 'block';
    this._renderTree();
  }

  private _renderTree(): void {
    if (this.disposed || !this.host) return;
    const ctxValue = {
      onEvent: this._onEvent,
      onImperativeClose: this._onImperativeClose,
      onImperativeAdvance: this._onImperativeAdvance,
    };

    const children: React.ReactNode[] = [
      React.createElement(ReadinessProbe, { key: 'probe', onReady: this._onReady }),
    ];

    if (this._visible && this._currentShowParams) {
      const params = this._currentShowParams;
      if (this._phase === 'interstitial') {
        children.push(
          React.createElement(MiniGameInterstitial, {
            key: `interstitial-${this._showNonce}`,
            isOpen: true,
            charImage: params.charImage,
            // CTA / close / ESC route through SimulaImperativeContext; the
            // required declarative callbacks are satisfied with no-ops so
            // TypeScript stays happy.
            onClick: () => { /* handled via SimulaImperativeContext */ },
            onClose: () => { /* handled via SimulaImperativeContext */ },
          }),
        );
      } else if (this._phase === 'game' && this._preload) {
        const preload = this._preload;
        children.push(
          React.createElement(MiniGameMenu, {
            key: `game-${this._showNonce}`,
            isOpen: true,
            onClose: () => {
              // Terminal close from the game/ad flow. Per proposal #19,
              // emit SDK `CLOSED` exactly once BEFORE clearing visible /
              // ready / preload / phase / host / show params (i.e.,
              // before teardown) so consumers like CharacterPage can
              // leave their local `showing` state and relaunch from the
              // trigger. `DISPLAY_FAILED` has its own path in `_onEvent`
              // that tears down WITHOUT emitting `CLOSED`.
              this._closeFromTerminalGame();
            },
            charName: params.charName,
            charID: params.charID,
            charImage: params.charImage,
            charDesc: params.charDesc,
            messages: params.messages,
            delegateChar: this.config.delegateChar ?? true,
            _preloadedEntry: {
              gameId: preload.selectedGame.id,
              gameName: preload.selectedGame.name,
              gameDescription: preload.selectedGame.description,
              games: preload.catalog,
              menuId: preload.menuId,
              preloadedMinigame: preload.minigame,
              preloadedFallbackAdUrl:
                preload.fallbackAd.kind === 'iframe'
                  ? preload.fallbackAd.iframeUrl
                  : null,
            },
          }),
        );
        // DISPLAY_FAILED: GameIframe emits via SimulaImperativeContext on
        // mount failure; this manager's `_onEvent` dedupes + auto-tears
        // down. See plan §Edge cases.
      }
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
