import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  buildIpv4BeaconUrl,
  fireIpv4Beacon,
  onIpv4Logout,
  _resetIpv4BeaconForTests,
} from '../ipv4Beacon';

describe('buildIpv4BeaconUrl (native parity contract)', () => {
  it('carries k/sid/ppid/p/r/t params', () => {
    const url = buildIpv4BeaconUrl('key-1', 'sess-1', 'user-1', 'init', 123);
    expect(url).toContain('k=key-1');
    expect(url).toContain('sid=sess-1');
    expect(url).toContain('ppid=user-1');
    expect(url).toContain('p=web'); // platform is "web" from this SDK
    expect(url).toContain('r=init');
    expect(url).toContain('t=123');
  });

  it('omits sid/ppid when absent', () => {
    const url = buildIpv4BeaconUrl('key-1', undefined, undefined, 'init', 123);
    expect(url).not.toContain('sid=');
    expect(url).not.toContain('ppid=');
    expect(url).toContain('k=key-1');
  });
});

describe('fireIpv4Beacon', () => {
  beforeEach(() => {
    _resetIpv4BeaconForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fires once per identity (deduped)', async () => {
    const mock = vi.fn(async () => ({ ok: true }) as any);
    vi.stubGlobal('fetch', mock);
    fireIpv4Beacon('key-1', 'sess-1', 'user-1', 'init');
    fireIpv4Beacon('key-1', 'sess-1', 'user-1', 'init');
    await new Promise((r) => setTimeout(r, 10));
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it('a new session id is a new identity and re-fires', async () => {
    const mock = vi.fn(async () => ({ ok: true }) as any);
    vi.stubGlobal('fetch', mock);
    fireIpv4Beacon('key-1', 'sess-1', 'user-1', 'init');
    await new Promise((r) => setTimeout(r, 10));
    fireIpv4Beacon('key-1', 'sess-2', 'user-1', 'init');
    await new Promise((r) => setTimeout(r, 10));
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it('onLogout resets dedup so re-login captures fresh', async () => {
    const mock = vi.fn(async () => ({ ok: true }) as any);
    vi.stubGlobal('fetch', mock);
    fireIpv4Beacon('key-1', 'sess-1', 'user-1', 'init');
    await new Promise((r) => setTimeout(r, 10));
    onIpv4Logout();
    fireIpv4Beacon('key-1', 'sess-1', 'user-1', 'init');
    await new Promise((r) => setTimeout(r, 10));
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it('never fires without an apiKey', async () => {
    const mock = vi.fn(async () => ({ ok: true }) as any);
    vi.stubGlobal('fetch', mock);
    fireIpv4Beacon('', 'sess-1', 'user-1', 'init');
    await new Promise((r) => setTimeout(r, 10));
    expect(mock).not.toHaveBeenCalled();
  });
});
