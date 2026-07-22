// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SimulaAds } from '../../core/SimulaAds';
import { SessionManager } from '../../core/session';
import { SimulaStorage } from '../../core/storage';
import { SimulaPrivacy } from '../../privacy/SimulaPrivacy';
import { Telemetry } from '../../telemetry/telemetry';
import { SimulaRewardedAd } from '../SimulaRewardedAd';
import { SimulaAdEvent } from '../events';
import { _resetFullscreenForTests } from '../fullscreenPresenter';
import { RewardVerificationQueue } from '../rewardVerificationQueue';

const REWARDED_CREATIVE = {
  impression_id: 'imp-r1',
  ad_inserted: true,
  rendered_html: '<html><body>game</body></html>',
  bid_amt: 3,
  ad_behavior: { close: { delay_seconds: 5, treatment: 'reward_or_close_label' } },
};

function stubFetch() {
  const verifyPosts: any[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: any, init?: any) => {
      const url = String(input);
      if (url.includes('/session/create')) {
        return { ok: true, status: 200, json: async () => ({ sessionId: 'sess-1' }) } as any;
      }
      if (url.includes('/load/rewarded')) {
        return { ok: true, status: 200, json: async () => REWARDED_CREATIVE } as any;
      }
      if (url.includes('/minigames/verify-reward')) {
        verifyPosts.push(JSON.parse((init?.body as string) ?? '{}'));
        return { ok: true, status: 200, json: async () => ({ verified: true, token: 'tok-1' }) } as any;
      }
      return { ok: true, status: 200, json: async () => ({}) } as any;
    }),
  );
  return verifyPosts;
}

describe('rewarded earned-gate (Kotlin parity: verify only when the gate elapsed)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.documentElement.style.overflow = '';
    SimulaAds._resetForTests();
    SessionManager._resetForTests();
    SimulaStorage._resetForTests();
    SimulaPrivacy._resetForTests();
    Telemetry._resetForTests();
    RewardVerificationQueue._resetForTests();
    _resetFullscreenForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    document.body.innerHTML = '';
    document.documentElement.style.overflow = '';
  });

  async function loadRewarded(): Promise<{ ad: SimulaRewardedAd; events: SimulaAdEvent[] }> {
    const ad = new SimulaRewardedAd('unit-r');
    const events: SimulaAdEvent[] = [];
    ad.addAdEventsListener((e) => events.push(e));
    ad.load();
    await new Promise((r) => setTimeout(r, 10));
    return { ad, events };
  }

  it('close BEFORE the gate: no verification POST, no REWARD_VERIFICATION_FAILED', async () => {
    const verifyPosts = stubFetch();
    SimulaAds.initialize({ apiKey: 'key-1' });
    await new Promise((r) => setTimeout(r, 5));

    const { ad, events } = await loadRewarded();
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'setInterval'] });
    ad.show();
    await vi.advanceTimersByTimeAsync(2000); // 2s of a 5s gate

    ad.destroy(); // closes the presentation pre-gate
    await vi.advanceTimersByTimeAsync(100);

    expect(events.map((e) => e.type)).not.toContain('EARNED_REWARD');
    expect(events.map((e) => e.type)).not.toContain('REWARD_VERIFICATION_FAILED');
    expect(events.map((e) => e.type)).toContain('CLOSED');
    expect(verifyPosts).toHaveLength(0);
    expect(RewardVerificationQueue.size()).toBe(0);
  });

  it('close AFTER the gate: EARNED_REWARD fired and verification POSTs with dwell time', async () => {
    const verifyPosts = stubFetch();
    SimulaAds.initialize({ apiKey: 'key-1' });
    await new Promise((r) => setTimeout(r, 5));

    const { ad, events } = await loadRewarded();
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'setInterval'] });
    ad.show();
    await vi.advanceTimersByTimeAsync(5000); // full 5s gate

    expect(events.map((e) => e.type)).toContain('EARNED_REWARD');

    (document.querySelector('button[aria-label="Close ad"]') as HTMLButtonElement).click();
    await vi.advanceTimersByTimeAsync(100);

    expect(verifyPosts).toHaveLength(1);
    expect(verifyPosts[0]).toMatchObject({
      serve_id: 'imp-r1',
      session_id: 'sess-1',
      elapsed_play_time: 5,
      ad_unit_id: 'unit-r',
    });
    expect(events.map((e) => e.type)).toContain('REWARD_VERIFIED');
    expect(events.find((e) => e.type === 'REWARD_VERIFIED')?.rewardToken).toBe('tok-1');
  });
});
