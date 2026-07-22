import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionManager } from '../session';

function stubSessionFetch() {
  const calls: { url: string; method: string }[] = [];
  const mock = vi.fn(async (input: any, init?: any) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    calls.push({ url, method });
    if (url.includes('/session/create')) {
      return { ok: true, json: async () => ({ sessionId: 'sess-1' }) } as any;
    }
    if (url.includes('/ppid/')) {
      return { ok: true, json: async () => ({}) } as any;
    }
    return { ok: true, json: async () => ({}) } as any;
  });
  vi.stubGlobal('fetch', mock);
  return { mock, calls };
}

describe('SessionManager', () => {
  beforeEach(() => {
    SessionManager._resetForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('coalesces concurrent ensureSession calls into one create', async () => {
    const { calls } = stubSessionFetch();
    SessionManager.configure('key-1', false, 'user-1');

    const [a, b] = await Promise.all([SessionManager.ensureSession(), SessionManager.ensureSession()]);
    expect(a).toBe('sess-1');
    expect(b).toBe('sess-1');
    expect(calls.filter((c) => c.url.includes('/session/create'))).toHaveLength(1);
  });

  it('reuses the live session instead of re-creating', async () => {
    const { calls } = stubSessionFetch();
    SessionManager.configure('key-1', false);

    await SessionManager.ensureSession();
    const again = await SessionManager.ensureSession();
    expect(again).toBe('sess-1');
    expect(calls.filter((c) => c.url.includes('/session/create'))).toHaveLength(1);
  });

  it('resync during an in-flight create starts a FRESH create (stale one never satisfies it)', async () => {
    // First create hangs until released; the post-resync create resolves fast
    let releaseFirst: ((v: any) => void) | null = null;
    let createCount = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: any) => {
        const url = String(input);
        if (url.includes('/session/create')) {
          createCount += 1;
          if (createCount === 1) {
            return new Promise((resolve) => {
              releaseFirst = resolve;
            });
          }
          return { ok: true, json: async () => ({ sessionId: `sess-${createCount}` }) } as any;
        }
        return { ok: true, json: async () => ({}) } as any;
      }),
    );
    SessionManager.configure('key-1', false, 'user-1');

    const stale = SessionManager.ensureSession(); // in flight, hanging
    SessionManager.resync('user-2'); // consent changed mid-create

    // The new generation's create resolves and installs its session
    await new Promise((r) => setTimeout(r, 10));
    expect(SessionManager.getSessionId()).toBe('sess-2');
    expect(createCount).toBe(2);

    // The stale create finally lands — discarded, never installed
    releaseFirst!({ ok: true, json: async () => ({ sessionId: 'sess-stale' }) });
    await expect(stale).resolves.toBeUndefined();
    expect(SessionManager.getSessionId()).toBe('sess-2');
  });

  it('carries the ppid on session/create', async () => {
    const { calls } = stubSessionFetch();
    SessionManager.configure('key-1', false, 'user-1');
    await SessionManager.ensureSession();
    expect(calls[0].url).toContain('ppid=user-1');
    expect(SessionManager.getSessionUserID()).toBe('user-1');
  });

  it('PATCHes the live session on login/switch (serialized)', async () => {
    const { calls } = stubSessionFetch();
    SessionManager.configure('key-1', false, 'user-1');
    await SessionManager.ensureSession();

    SessionManager.updatePrimaryUserID('user-2', true);
    // Let the serialized ppid chain drain
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    const patches = calls.filter((c) => c.method === 'PATCH' && c.url.includes('/session/sess-1/ppid/user-2'));
    expect(patches).toHaveLength(1);
    expect(SessionManager.getSessionUserID()).toBe('user-2');
  });

  it('logout is local-only (no PATCH, session identity stale)', async () => {
    const { calls } = stubSessionFetch();
    SessionManager.configure('key-1', false, 'user-1');
    await SessionManager.ensureSession();

    SessionManager.updatePrimaryUserID(null, true);
    await new Promise((r) => setTimeout(r, 0));

    expect(calls.filter((c) => c.method === 'PATCH')).toHaveLength(0);
    expect(SessionManager.getSessionUserID()).toBeUndefined();
  });

  it('suppresses ppid when consent is revoked', async () => {
    const { calls } = stubSessionFetch();
    SessionManager.configure('key-1', false, 'user-1');
    await SessionManager.ensureSession();

    SessionManager.updatePrimaryUserID('user-1', false);
    await new Promise((r) => setTimeout(r, 0));

    expect(calls.filter((c) => c.method === 'PATCH')).toHaveLength(0);
    expect(SessionManager.getSessionUserID()).toBeUndefined();
  });

  it('logout fires the hook even when identity was only pending (no session yet)', async () => {
    stubSessionFetch();
    const onLogout = vi.fn();
    SessionManager.configure('key-1', false, 'user-1', { onLogout });
    // No ensureSession — identity exists only as pendingUserID
    SessionManager.updatePrimaryUserID(null, true);
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it('notifies subscribers on session install', async () => {
    stubSessionFetch();
    SessionManager.configure('key-1', false);
    const seen: (string | undefined)[] = [];
    SessionManager.subscribe((id) => seen.push(id));
    await SessionManager.ensureSession();
    expect(seen).toEqual(['sess-1']);
  });
});
