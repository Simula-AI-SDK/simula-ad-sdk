import { createSession, updateSessionPpid, SessionTelemetryDirective } from '../utils/api';

export type SessionListener = (sessionId: string | undefined) => void;

/** Lifecycle hooks wired by SimulaAds (IPv4 beacon, telemetry directive). */
export interface SessionHooks {
  /** A fresh session was installed (carries the identity the session represents). */
  onSessionInstalled?: (sessionId: string, ppid: string | undefined) => void;
  /** A queued PPID reconcile PATCH landed server-side. */
  onPpidReconciled?: (ppid: string) => void;
  /** The PPID was cleared (logout) — local-only, the backend can't express an empty id. */
  onLogout?: () => void;
  /** Server telemetry directive from the /session/create response. */
  onTelemetryDirective?: (directive: SessionTelemetryDirective) => void;
}

/**
 * SessionManager — process-wide session lifecycle (mirrors `SimulaSessionStore`
 * in the Kotlin SDK).
 *
 * - `ensureSession()` coalesces concurrent callers into a single in-flight
 *   create and reuses the live session afterwards
 * - generation tag: an apiKey change or a consent-driven resync bumps the
 *   generation so a stale in-flight create can never install its session
 * - PPID updates are serialized through a promise chain; logout (null) is
 *   local-only — the backend `PATCH …/ppid/{ppid}` path can't express an empty
 *   id (same semantics as the native SDKs)
 * - memory-only: a page reload creates a fresh session, matching the native
 *   per-process behavior
 */
class SessionManagerImpl {
  private sessionId: string | undefined;
  /** Identity the live session represents server-side (may lag pendingUserID while a PATCH is queued). */
  private sessionUserID: string | undefined;
  private generation = 0;
  private inflight: Promise<string | undefined> | null = null;
  private apiKey = '';
  private devMode = false;
  /** Value the NEXT session/create carries. */
  private pendingUserID: string | undefined;
  private ppidChain: Promise<void> = Promise.resolve();
  private listeners = new Set<SessionListener>();
  private hooks: SessionHooks = {};

  configure(apiKey: string, devMode: boolean, primaryUserID?: string, hooks: SessionHooks = {}): void {
    if (this.apiKey && this.apiKey !== apiKey) {
      // apiKey change — everything about the old session is stale
      this.generation++;
      this.setSession(undefined, undefined);
    }
    this.apiKey = apiKey;
    this.devMode = devMode;
    this.pendingUserID = primaryUserID;
    this.hooks = hooks;
  }

  getSessionId(): string | undefined {
    return this.sessionId;
  }

  getSessionUserID(): string | undefined {
    return this.sessionUserID;
  }

  ensureSession(): Promise<string | undefined> {
    if (this.sessionId) return Promise.resolve(this.sessionId);
    if (this.inflight) return this.inflight;

    const generationAtStart = this.generation;
    const ppid = this.pendingUserID;
    const promise = createSession(this.apiKey, this.devMode, ppid)
      .then((result) => {
        if (this.inflight === promise) this.inflight = null;
        this.hooks.onTelemetryDirective?.(result.directive);
        const id = result.sessionId;
        if (id && generationAtStart === this.generation) {
          this.setSession(id, ppid);
          this.hooks.onSessionInstalled?.(id, ppid);
          return id;
        }
        return undefined;
      })
      .catch(() => {
        if (this.inflight === promise) this.inflight = null;
        return undefined; // createSession never throws — belt and braces
      });
    this.inflight = promise;
    return promise;
  }

  /**
   * Consent-driven session re-sync (native parity): the resolved consent state
   * changed, so the current session no longer carries valid privacy signals.
   * Drops the session and re-creates with the fresh privacy context.
   */
  resync(newPrimaryUserID?: string): void {
    this.pendingUserID = newPrimaryUserID;
    this.generation++;
    this.setSession(undefined, undefined);
    void this.ensureSession();
  }

  /**
   * Serialized, best-effort. Mirrors Kotlin `SimulaAds.updatePrimaryUserID`:
   * the value the next session/create carries is always updated; a live
   * session is PATCHed only on login/switch (never on logout, which the
   * backend path can't express — the session identity is then treated stale).
   */
  updatePrimaryUserID(id: string | null, allowsPpid: boolean): void {
    const normalized = allowsPpid && id && id.trim() ? id : null;
    // Capture identity BEFORE overwriting — the logout hook must fire even when
    // the identity was only pending (session not yet created), so the IPv4
    // beacon's dedup state resets for the next login.
    const hadIdentity = this.sessionUserID !== undefined || this.pendingUserID !== undefined;
    this.pendingUserID = normalized ?? undefined;

    if (normalized === null) {
      this.sessionUserID = undefined;
      if (hadIdentity) this.hooks.onLogout?.();
      return;
    }
    if (!this.sessionId) return; // next createSession carries the value
    if (this.sessionUserID === normalized) return;

    const sid = this.sessionId;
    const ppid = normalized;
    this.ppidChain = this.ppidChain.then(async () => {
      // The world may have moved on while this update sat in the queue
      if (this.sessionId !== sid || this.pendingUserID !== ppid) return;
      await updateSessionPpid(sid, ppid);
      if (this.sessionId === sid) {
        this.sessionUserID = ppid;
        this.hooks.onPpidReconciled?.(ppid);
      }
    });
  }

  subscribe(listener: SessionListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private setSession(id: string | undefined, userID: string | undefined): void {
    this.sessionId = id;
    this.sessionUserID = userID;
    this.listeners.forEach((listener) => {
      try {
        listener(id);
      } catch {
        // A broken host listener must never break the SDK
      }
    });
  }

  /** Test hook. Not public API. */
  _resetForTests(): void {
    this.sessionId = undefined;
    this.sessionUserID = undefined;
    this.generation = 0;
    this.inflight = null;
    this.apiKey = '';
    this.devMode = false;
    this.pendingUserID = undefined;
    this.ppidChain = Promise.resolve();
    this.listeners.clear();
    this.hooks = {};
  }
}

export const SessionManager = new SessionManagerImpl();
