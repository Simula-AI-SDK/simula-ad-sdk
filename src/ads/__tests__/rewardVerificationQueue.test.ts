import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RewardVerificationQueue } from '../rewardVerificationQueue';
import { SimulaStorage } from '../../core/storage';

function stubVerifyFetch(handler: (body: any) => { status: number; json?: any }) {
  const calls: any[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: any, init?: any) => {
      const body = JSON.parse((init?.body as string) ?? '{}');
      calls.push(body);
      const result = handler(body);
      return {
        ok: result.status >= 200 && result.status < 300,
        status: result.status,
        json: async () => result.json ?? {},
      } as any;
    }),
  );
  return calls;
}

const params = { serveId: 'serve-1', sessionId: 'sess-1', elapsedPlayTime: 12, adUnitId: 'unit-1' };

describe('RewardVerificationQueue (native parity: durable idempotent SSV)', () => {
  beforeEach(() => {
    RewardVerificationQueue._resetForTests();
    SimulaStorage._resetForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends the native wire body (serve_id/session_id/elapsed_play_time/ad_unit_id)', async () => {
    const calls = stubVerifyFetch(() => ({ status: 200, json: { verified: true, token: 'tok-1' } }));
    RewardVerificationQueue.enqueue(params, { onVerified: () => {}, onFailed: () => {} });
    await new Promise((r) => setTimeout(r, 10));
    expect(calls[0]).toEqual({
      serve_id: 'serve-1',
      session_id: 'sess-1',
      elapsed_play_time: 12,
      ad_unit_id: 'unit-1',
    });
  });

  it('2xx verified → onVerified(token), queue empties', async () => {
    stubVerifyFetch(() => ({ status: 200, json: { verified: true, token: 'tok-1' } }));
    const seen: (string | undefined)[] = [];
    RewardVerificationQueue.enqueue(params, { onVerified: (t) => seen.push(t), onFailed: () => {} });
    await new Promise((r) => setTimeout(r, 10));
    expect(seen).toEqual(['tok-1']);
    expect(RewardVerificationQueue.size()).toBe(0);
  });

  it('HTTP 409 is idempotent SUCCESS (never double-grants)', async () => {
    stubVerifyFetch(() => ({ status: 409 }));
    const seen: string[] = [];
    RewardVerificationQueue.enqueue(params, { onVerified: () => seen.push('verified'), onFailed: () => seen.push('failed') });
    await new Promise((r) => setTimeout(r, 10));
    expect(seen).toEqual(['verified']);
    expect(RewardVerificationQueue.size()).toBe(0);
  });

  it('2xx verified:false → onFailed (server rejected the play-through)', async () => {
    stubVerifyFetch(() => ({ status: 200, json: { verified: false } }));
    const seen: string[] = [];
    RewardVerificationQueue.enqueue(params, { onVerified: () => seen.push('verified'), onFailed: () => seen.push('failed') });
    await new Promise((r) => setTimeout(r, 10));
    expect(seen).toEqual(['failed']);
    expect(RewardVerificationQueue.size()).toBe(0);
  });

  it('other 4xx are permanent: dropped + onFailed', async () => {
    stubVerifyFetch(() => ({ status: 400 }));
    const seen: string[] = [];
    RewardVerificationQueue.enqueue(params, { onVerified: () => seen.push('verified'), onFailed: () => seen.push('failed') });
    await new Promise((r) => setTimeout(r, 10));
    expect(seen).toEqual(['failed']);
    expect(RewardVerificationQueue.size()).toBe(0);
  });

  it('5xx stays queued for retry (durable)', async () => {
    stubVerifyFetch(() => ({ status: 500 }));
    RewardVerificationQueue.enqueue(params, { onVerified: () => {}, onFailed: () => {} });
    await new Promise((r) => setTimeout(r, 10));
    expect(RewardVerificationQueue.size()).toBe(1);
  });

  it.each([408, 429])('%i is transient: stays queued, never reports permanent failure (native parity)', async (status) => {
    stubVerifyFetch(() => ({ status }));
    const seen: string[] = [];
    RewardVerificationQueue.enqueue(params, { onVerified: () => seen.push('verified'), onFailed: () => seen.push('failed') });
    await new Promise((r) => setTimeout(r, 10));
    expect(seen).toEqual([]); // no permanent-failure callback
    expect(RewardVerificationQueue.size()).toBe(1); // queued for retry
  });

  it('retries backed-off items automatically when due (PR #12 thread #17)', async () => {
    vi.useFakeTimers(); // fakes Date + timers; microtasks still flush between advances
    try {
      let attempt = 0;
      const calls = stubVerifyFetch(() => {
        attempt++;
        return attempt === 1 ? { status: 500 } : { status: 200, json: { verified: true, token: 'tok-1' } };
      });
      const seen: string[] = [];
      RewardVerificationQueue.enqueue(params, { onVerified: () => seen.push('verified'), onFailed: () => seen.push('failed') });

      // First attempt fails (500) → item stays queued with a 5s backoff
      await vi.advanceTimersByTimeAsync(20);
      expect(calls).toHaveLength(1);
      expect(RewardVerificationQueue.size()).toBe(1);

      // The queue schedules its own retry — no new enqueue or reload needed
      await vi.advanceTimersByTimeAsync(5100);

      expect(calls.length).toBeGreaterThanOrEqual(2);
      expect(seen).toEqual(['verified']);
      expect(RewardVerificationQueue.size()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('dedupes by serveId', async () => {
    const calls = stubVerifyFetch(() => ({ status: 200, json: { verified: true } }));
    RewardVerificationQueue.enqueue(params, { onVerified: () => {}, onFailed: () => {} });
    RewardVerificationQueue.enqueue(params, { onVerified: () => {}, onFailed: () => {} });
    await new Promise((r) => setTimeout(r, 10));
    expect(calls).toHaveLength(1);
  });

  it('recovers a persisted queue on trigger (survives page reload)', async () => {
    SimulaStorage.setJSON('reward_verification_queue', [
      { serveId: 'serve-old', sessionId: 'sess-1', elapsedPlayTime: 9, adUnitId: 'unit-1', retryCount: 0, lastAttemptTimestamp: 0 },
    ]);
    const calls = stubVerifyFetch(() => ({ status: 200, json: { verified: true, token: 'tok-old' } }));
    RewardVerificationQueue.triggerProcessQueue();
    await new Promise((r) => setTimeout(r, 10));
    expect(calls[0].serve_id).toBe('serve-old');
    expect(RewardVerificationQueue.size()).toBe(0);
  });
});
