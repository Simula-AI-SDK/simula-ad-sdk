import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadInterstitialAd, loadRewardedAd } from '../api';
import { SimulaPrivacy } from '../../privacy/SimulaPrivacy';

/**
 * PII gating at the wire chokepoint: `userEmail` / `userProfile` must never
 * leave the SDK when the resolved consent state disallows PII — for EVERY
 * load endpoint, not just NativeBanner (PR #12: "Context PII on fullscreen loads").
 */
describe('contextBody PII gating (interstitial/rewarded loads)', () => {
  const CONTEXT = {
    searchTerm: 'boots',
    userEmail: 'pii@example.com',
    userProfile: 'age 30, hiker',
  };

  let bodies: any[];

  beforeEach(() => {
    SimulaPrivacy._resetForTests();
    bodies = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: any, init?: any) => {
        bodies.push(JSON.parse((init?.body as string) ?? '{}'));
        return { ok: true, status: 200, json: async () => ({ ad_inserted: false }) } as any;
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    SimulaPrivacy._resetForTests();
  });

  it('forwards PII fields when consent allows', async () => {
    SimulaPrivacy.apply({ hasPrivacyConsent: true });
    await loadInterstitialAd({ apiKey: 'k', adUnitId: 'u', sessionId: 's', context: CONTEXT });
    expect(bodies[0].context.userEmail).toBe('pii@example.com');
    expect(bodies[0].context.userProfile).toBe('age 30, hiker');
  });

  it('strips PII when consent is revoked (interstitial)', async () => {
    SimulaPrivacy.apply({ hasPrivacyConsent: false });
    await loadInterstitialAd({ apiKey: 'k', adUnitId: 'u', sessionId: 's', context: CONTEXT });
    expect(bodies[0].context.userEmail).toBeUndefined();
    expect(bodies[0].context.userProfile).toBeUndefined();
    expect(bodies[0].context.searchTerm).toBe('boots'); // contextual signals stay
  });

  it('strips PII under COPPA (rewarded)', async () => {
    SimulaPrivacy.apply({ hasPrivacyConsent: true, coppaApplies: true });
    await loadRewardedAd({ apiKey: 'k', adUnitId: 'u', sessionId: 's', context: CONTEXT });
    expect(bodies[0].context.userEmail).toBeUndefined();
    expect(bodies[0].context.userProfile).toBeUndefined();
  });
});
