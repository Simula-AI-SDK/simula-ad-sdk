import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SimulaAds } from '../SimulaAds';
import { SessionManager } from '../session';
import { SimulaStorage } from '../storage';
import { SimulaPrivacy } from '../../privacy/SimulaPrivacy';
import { Telemetry } from '../../telemetry/telemetry';
import { BeaconQueue } from '../beaconQueue';
import { _resetIpv4BeaconForTests } from '../ipv4Beacon';

function stubFetch(freqCapHandler?: (url: string) => any) {
  const calls: string[] = [];
  const mock = vi.fn(async (input: any, init?: any) => {
    const url = String(input);
    calls.push(`${init?.method ?? 'GET'} ${url}`);
    if (url.includes('/session/create')) {
      return { ok: true, json: async () => ({ sessionId: 'sess-1' }) } as any;
    }
    if (url.includes('/frequency-cap/status')) {
      if (freqCapHandler) return freqCapHandler(url);
      return { ok: true, json: async () => ({ capped: false }) } as any;
    }
    return { ok: true, json: async () => ({}) } as any;
  });
  vi.stubGlobal('fetch', mock);
  return { mock, calls };
}

describe('SimulaAds', () => {
  beforeEach(() => {
    SimulaAds._resetForTests();
    SessionManager._resetForTests();
    SimulaStorage._resetForTests();
    SimulaPrivacy._resetForTests();
    Telemetry._resetForTests();
    BeaconQueue._resetForTests();
    _resetIpv4BeaconForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects an empty apiKey without throwing', () => {
    stubFetch();
    expect(SimulaAds.initialize({ apiKey: '' })).toBe(false);
    expect(SimulaAds.initialize({ apiKey: '   ' })).toBe(false);
    expect(SimulaAds.isInitialized()).toBe(false);
  });

  it('first valid call wins', () => {
    stubFetch();
    expect(SimulaAds.initialize({ apiKey: 'key-1' })).toBe(true);
    expect(SimulaAds.initialize({ apiKey: 'key-2' })).toBe(false);
    expect(SimulaAds.isInitialized()).toBe(true);
  });

  it('warms the session off the critical path on initialize', async () => {
    const { calls } = stubFetch();
    SimulaAds.initialize({ apiKey: 'key-1', primaryUserID: 'user-1' });
    await new Promise((r) => setTimeout(r, 0));
    expect(calls.some((c) => c.includes('/session/create') && c.includes('ppid=user-1'))).toBe(true);
    expect(SimulaAds.getSessionId()).toBe('sess-1');
  });

  it('checkFrequencyCap fails open when uninitialized', async () => {
    stubFetch();
    expect(await SimulaAds.checkFrequencyCap('unit-1')).toBe(false);
  });

  it('checkFrequencyCap fails open on blank adUnitId', async () => {
    stubFetch();
    SimulaAds.initialize({ apiKey: 'key-1' });
    expect(await SimulaAds.checkFrequencyCap('')).toBe(false);
    expect(await SimulaAds.checkFrequencyCap('  ')).toBe(false);
  });

  it('checkFrequencyCap returns the backend verdict', async () => {
    stubFetch(() => ({ ok: true, json: async () => ({ capped: true }) }) as any);
    SimulaAds.initialize({ apiKey: 'key-1' });
    expect(await SimulaAds.checkFrequencyCap('unit-1')).toBe(true);
  });

  it('checkFrequencyCap fails open on network failure', async () => {
    stubFetch(() => {
      throw new Error('network down');
    });
    SimulaAds.initialize({ apiKey: 'key-1' });
    expect(await SimulaAds.checkFrequencyCap('unit-1')).toBe(false);
  });

  it('caches a capped verdict for the local day (no second request)', async () => {
    const { calls } = stubFetch(() => ({ ok: true, json: async () => ({ capped: true }) }) as any);
    SimulaAds.initialize({ apiKey: 'key-1' });

    expect(await SimulaAds.checkFrequencyCap('unit-1')).toBe(true);
    expect(await SimulaAds.checkFrequencyCap('unit-1')).toBe(true);
    expect(calls.filter((c) => c.includes('/frequency-cap/status'))).toHaveLength(1);

    // Single fixed storage key — { day, entries } — never accumulates day keys
    const stored = SimulaStorage.getJSON<{ day: string; entries: Record<string, boolean> }>('freqcap');
    expect(stored?.entries['unit-1|']).toBe(true);
    expect(SimulaStorage.get('freqcap:2026-1-1')).toBeNull();
  });

  it('a capped verdict expires when the local day rolls over', async () => {
    const { calls } = stubFetch(() => ({ ok: true, json: async () => ({ capped: true }) }) as any);
    SimulaAds.initialize({ apiKey: 'key-1' });
    expect(await SimulaAds.checkFrequencyCap('unit-1')).toBe(true);

    // Next local day → the cached verdict no longer applies
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    vi.setSystemTime(tomorrow);
    try {
      expect(await SimulaAds.checkFrequencyCap('unit-1')).toBe(true);
      expect(calls.filter((c) => c.includes('/frequency-cap/status'))).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not cache an uncapped verdict', async () => {
    const { calls } = stubFetch(() => ({ ok: true, json: async () => ({ capped: false }) }) as any);
    SimulaAds.initialize({ apiKey: 'key-1' });

    expect(await SimulaAds.checkFrequencyCap('unit-1')).toBe(false);
    expect(await SimulaAds.checkFrequencyCap('unit-1')).toBe(false);
    expect(calls.filter((c) => c.includes('/frequency-cap/status'))).toHaveLength(2);
  });

  it('updateContext full-replaces and ignores invalid contexts', () => {
    stubFetch();
    SimulaAds.initialize({ apiKey: 'key-1' });
    SimulaAds.updateContext({ searchTerm: 'cooking' });
    expect(SimulaAds.getContext()).toEqual({ searchTerm: 'cooking' });
    SimulaAds.updateContext({ bogus: true } as any);
    expect(SimulaAds.getContext()).toEqual({ searchTerm: 'cooking' });
    SimulaAds.updateContext(null);
    expect(SimulaAds.getContext()).toBeNull();
  });

  it('every public method is a safe no-op before initialize', async () => {
    stubFetch();
    expect(() => {
      SimulaAds.updateContext({ searchTerm: 'x' });
      SimulaAds.updatePrimaryUserID('user-1');
    }).not.toThrow();
    expect(await SimulaAds.checkFrequencyCap('unit-1')).toBe(false);
    expect(SimulaAds.getSessionId()).toBeUndefined();
  });
});
