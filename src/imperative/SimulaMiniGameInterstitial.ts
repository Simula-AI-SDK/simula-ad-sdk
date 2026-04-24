import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { SimulaProvider } from '../SimulaProvider';
import { MiniGameInterstitial } from '../components/miniGame/MiniGameInterstitial';
import { SimulaImperativeContext } from './SimulaImperativeContext';
import { ReadinessProbe } from './ReadinessProbe';
import { EventRegistry } from './events';
import type {
  InterstitialInitConfig,
  ImperativeShowParams,
  SimulaAdEventSubscription,
  SimulaEventHandler,
  SimulaEventType,
} from './types';

const DEFAULT_MIN_PLAY_THRESHOLD = 15;
const MIN_PLAY_THRESHOLD_LOWER = 10;
const MIN_PLAY_THRESHOLD_UPPER = 30;
const LOAD_TIMEOUT_MS = 15000;

function clampMinPlayThreshold(value: number | undefined): number {
  const raw = typeof value === 'number' && !Number.isNaN(value)
    ? value
    : DEFAULT_MIN_PLAY_THRESHOLD;
  return Math.max(MIN_PLAY_THRESHOLD_LOWER, Math.min(MIN_PLAY_THRESHOLD_UPPER, Math.round(raw)));
}

/**
 * Imperative wrapper over the declarative `MiniGameInterstitial`.
 *
 * Lifecycle:
 *  - `.init(config)` constructs the manager (static factory).
 *  - `.load()` creates a hidden DOM host, mounts a private SimulaProvider
 *    tree via legacy `ReactDOM.render`, and resolves when the ReadinessProbe
 *    sees a truthy `sessionId`. Idempotent.
 *  - `.show(params)` flips the host visible and mounts a fresh
 *    `<MiniGameInterstitial key={showNonce} isOpen=true />` child. If called
 *    before `.load()` completes, queues the payload and consumes it on ready.
 *  - The declarative component calls back through `SimulaImperativeContext`
 *    on CTA / close, which in turn invokes `onImperativeClose()` and
 *    re-renders the tree with the visible child nulled out so the component
 *    unmounts cleanly.
 *  - `.dispose()` unmounts + removes the host and short-circuits late state.
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

  private _pendingShowParams: ImperativeShowParams | null = null;
  private _currentShowParams: ImperativeShowParams | null = null;
  private _showNonce: number = 0;

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
    host.setAttribute('data-simula-imperative', 'interstitial');
    host.style.display = 'none';
    document.body.appendChild(host);
    this.host = host;
  }

  private _onReady = (_sessionId: string): void => {
    if (this.disposed || this._ready) return;
    this._ready = true;
    if (this._loadTimeout) {
      clearTimeout(this._loadTimeout);
      this._loadTimeout = null;
    }
    const resolve = this._loadResolve;
    this._loadResolve = null;
    this._loadReject = null;
    this.events.emit('LOADED', null);
    if (resolve) resolve();
  };

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

  private _onImperativeClose = (): void => {
    // Declarative component requested teardown (CTA / X / ESC).
    if (this.disposed) return;
    this._visible = false;
    this._currentShowParams = null;
    this._pendingShowParams = null;
    if (this.host) {
      this.host.style.display = 'none';
    }
    this._renderTree();
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
      children.push(
        React.createElement(MiniGameInterstitial, {
          key: `show-${this._showNonce}`,
          isOpen: true,
          charImage: this._currentShowParams.charImage,
          // CTA click is wired through the imperative context; provide a
          // no-op prop so TypeScript's required `onClick` is satisfied.
          onClick: () => { /* handled via SimulaImperativeContext */ },
          onClose: () => { /* handled via SimulaImperativeContext */ },
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
