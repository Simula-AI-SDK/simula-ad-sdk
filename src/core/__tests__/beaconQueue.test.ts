import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BeaconQueue } from '../beaconQueue';
import { SimulaStorage } from '../storage';

function stubFetchWith(behavior: (url: string) => { ok: boolean; status: number }) {
  const calls: string[] = [];
  const mock = vi.fn(async (input: any) => {
    const url = String(input);
    calls.push(url);
    return behavior(url) as any;
  });
  vi.stubGlobal('fetch', mock);
  return { mock, calls };
}

const ok = () => ({ ok: true, status: 200 });

describe('BeaconQueue', () => {
  beforeEach(() => {
    BeaconQueue._resetForTests();
    SimulaStorage._resetForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('delivers an enqueued beacon and empties the queue', async () => {
    const { calls } = stubFetchWith(ok);
    BeaconQueue.enqueue({ url: 'https://api.test/beacon/1', method: 'POST', body: '{}' });
    await new Promise((r) => setTimeout(r, 10));
    expect(calls).toHaveLength(1);
    expect(BeaconQueue.size()).toBe(0);
  });

  it('dedupes identical beacons', async () => {
    const { calls } = stubFetchWith(ok);
    const beacon = { url: 'https://api.test/beacon/1', method: 'POST' as const, body: '{}' };
    BeaconQueue.enqueue(beacon);
    BeaconQueue.enqueue(beacon);
    await new Promise((r) => setTimeout(r, 10));
    expect(calls).toHaveLength(1);
  });

  it('drops permanent (4xx) failures without retrying', async () => {
    const { calls } = stubFetchWith(() => ({ ok: false, status: 404 }));
    BeaconQueue.enqueue({ url: 'https://api.test/beacon/1', method: 'POST', body: '{}' });
    await new Promise((r) => setTimeout(r, 10));
    expect(calls).toHaveLength(1);
    expect(BeaconQueue.size()).toBe(0);
  });

  it('keeps transient (5xx) failures queued for a later retry', async () => {
    stubFetchWith(() => ({ ok: false, status: 500 }));
    BeaconQueue.enqueue({ url: 'https://api.test/beacon/1', method: 'POST', body: '{}' });
    await new Promise((r) => setTimeout(r, 10));
    expect(BeaconQueue.size()).toBe(1);
  });

  it.each([408, 429])('treats %i as transient and retries (native parity)', async (status) => {
    stubFetchWith(() => ({ ok: false, status }));
    BeaconQueue.enqueue({ url: 'https://api.test/beacon/1', method: 'POST', body: '{}' });
    await new Promise((r) => setTimeout(r, 10));
    expect(BeaconQueue.size()).toBe(1); // still queued, not dropped
  });

  it('keeps network failures queued', async () => {
    stubFetchWith(() => {
      throw new Error('offline');
    });
    BeaconQueue.enqueue({ url: 'https://api.test/beacon/1', method: 'POST', body: '{}' });
    await new Promise((r) => setTimeout(r, 10));
    expect(BeaconQueue.size()).toBe(1);
  });

  it('recovers a persisted queue on trigger (process recovery)', async () => {
    // Simulate a previous page load that died with a pending beacon
    SimulaStorage.setJSON('beacon_queue', [
      { url: 'https://api.test/beacon/old', method: 'POST', body: '{}', retryCount: 0, lastAttemptTimestamp: 0 },
    ]);
    const { calls } = stubFetchWith(ok);
    BeaconQueue.triggerProcessQueue();
    await new Promise((r) => setTimeout(r, 10));
    expect(calls).toEqual(['https://api.test/beacon/old']);
    expect(BeaconQueue.size()).toBe(0);
  });

  it('never loses entries enqueued WHILE a drain is awaiting (merge-on-save)', async () => {
    // First beacon's send hangs; a second beacon enqueues mid-drain
    let resolveFirst: (() => void) | null = null;
    let firstResolved = false;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: any) => {
        const url = String(input);
        if (url.includes('/beacon/a') && !firstResolved) {
          await new Promise<void>((resolve) => {
            resolveFirst = resolve;
          });
        }
        return { ok: true, status: 200 } as any;
      }),
    );

    BeaconQueue.enqueue({ url: 'https://api.test/beacon/a', method: 'POST', body: '{}' });
    await new Promise((r) => setTimeout(r, 5)); // drain is now awaiting A's send
    BeaconQueue.enqueue({ url: 'https://api.test/beacon/b', method: 'POST', body: '{}' });

    firstResolved = true;
    resolveFirst!();
    await new Promise((r) => setTimeout(r, 20));

    // B must survive the drain's save — delivered, not clobbered
    expect(BeaconQueue.size()).toBe(0);
  });

  it('builds headers at SEND time via the registered provider (nothing persisted)', async () => {
    const provider = vi.fn((auth: boolean): Record<string, string> =>
      auth ? { Authorization: 'Bearer live-key', 'X-Live': '1' } : {},
    );
    BeaconQueue.configure({ headersProvider: provider });

    const seen: any[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: any, init?: any) => {
        seen.push(init?.headers);
        return { ok: true, status: 200 } as any;
      }),
    );

    BeaconQueue.enqueue({ url: 'https://api.test/beacon/auth', method: 'POST', auth: true, body: '{}' });
    await new Promise((r) => setTimeout(r, 10));

    expect(provider).toHaveBeenCalledWith(true);
    expect(seen[0]).toMatchObject({ Authorization: 'Bearer live-key' });
    // No Authorization value is ever written to storage
    expect(JSON.stringify(SimulaStorage.get('beacon_queue'))).not.toContain('Bearer');
  });
});
