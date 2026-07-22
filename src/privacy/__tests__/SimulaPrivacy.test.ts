import { describe, it, expect, beforeEach } from 'vitest';
import {
  SimulaPrivacy,
  allowsPrimaryUserID,
  allowsLocalStorage,
  consentHeaders,
  privacyJson,
} from '../SimulaPrivacy';
import { SimulaStorage } from '../../core/storage';

describe('SimulaPrivacy', () => {
  beforeEach(() => {
    SimulaPrivacy._resetForTests();
    SimulaStorage._resetForTests();
  });

  it('defaults to a contextual, no-tracking posture', () => {
    const s = SimulaPrivacy.current;
    expect(s.hasPrivacyConsent).toBe(true);
    expect(s.coppaApplies).toBe(false);
    expect(s.tcString).toBeUndefined();
    expect(s.gdprApplies).toBeUndefined();
    expect(allowsPrimaryUserID(s)).toBe(true);
    expect(allowsLocalStorage(s)).toBe(true);
  });

  it('apply full-replaces the explicit config', () => {
    SimulaPrivacy.apply({ hasPrivacyConsent: false, tcString: 'tc-abc', gdprApplies: true });
    const s = SimulaPrivacy.current;
    expect(s.hasPrivacyConsent).toBe(false);
    expect(s.tcString).toBe('tc-abc');
    expect(s.gdprApplies).toBe(true);
  });

  it('update partial-merges', () => {
    SimulaPrivacy.apply({ tcString: 'tc-abc', coppaApplies: false });
    SimulaPrivacy.update({ coppaApplies: true });
    const s = SimulaPrivacy.current;
    expect(s.tcString).toBe('tc-abc');
    expect(s.coppaApplies).toBe(true);
  });

  it('clearConsent keeps the legacy flag and COPPA, drops IAB overrides', () => {
    SimulaPrivacy.apply({ hasPrivacyConsent: false, tcString: 'tc-abc', uspString: '1YNN', gdprApplies: true });
    SimulaPrivacy.clearConsent();
    const s = SimulaPrivacy.current;
    expect(s.hasPrivacyConsent).toBe(false);
    expect(s.tcString).toBeUndefined();
    expect(s.uspString).toBeUndefined();
    expect(s.gdprApplies).toBeUndefined();
  });

  it('COPPA suppresses the primaryUserID', () => {
    SimulaPrivacy.apply({ hasPrivacyConsent: true, coppaApplies: true });
    expect(allowsPrimaryUserID(SimulaPrivacy.current)).toBe(false);
  });

  it('under GDPR an unknown Purpose 1 denies local storage', () => {
    SimulaPrivacy.apply({ gdprApplies: true });
    expect(allowsLocalStorage(SimulaPrivacy.current)).toBe(false);
    SimulaPrivacy.update({ tcfPurpose1Consent: true });
    expect(allowsLocalStorage(SimulaPrivacy.current)).toBe(true);
    SimulaPrivacy.update({ tcfPurpose1Consent: false });
    expect(allowsLocalStorage(SimulaPrivacy.current)).toBe(false);
  });

  it('outside GDPR storage is permitted by default', () => {
    SimulaPrivacy.apply({ gdprApplies: false });
    expect(allowsLocalStorage(SimulaPrivacy.current)).toBe(true);
  });

  it('drives the SimulaStorage consent gate', () => {
    SimulaPrivacy.apply({ gdprApplies: true, tcfPurpose1Consent: false });
    expect(SimulaStorage.isPersistent()).toBe(false);
  });

  it('consentHeaders match the native header contract', () => {
    SimulaPrivacy.apply({
      gdprApplies: true,
      tcString: 'tc',
      uspString: '1YNN',
      gppString: 'gpp',
      gppSid: '2,6',
      tcfPurpose1Consent: true,
      coppaApplies: false,
    });
    expect(consentHeaders(SimulaPrivacy.current)).toEqual({
      'X-Simula-GDPR-Applies': '1',
      'X-Simula-Consent-TCString': 'tc',
      'X-Simula-Consent-USP': '1YNN',
      'X-Simula-Consent-GPP': 'gpp',
      'X-Simula-Consent-GPP-SID': '2,6',
      'X-Simula-Consent-Purpose1': '1',
      'X-Simula-COPPA': '0',
    });
  });

  it('privacyJson matches the native /session/create block', () => {
    SimulaPrivacy.apply({
      hasPrivacyConsent: true,
      gdprApplies: true,
      tcString: 'tc',
      tcfPurpose1Consent: false,
    });
    expect(privacyJson(SimulaPrivacy.current)).toEqual({
      hasPrivacyConsent: true,
      coppaApplies: false,
      gdprApplies: 1,
      tcString: 'tc',
      tcfPurpose1Consent: false,
    });
  });

  it('notifies subscribers (debounced) on changes', async () => {
    const seen: boolean[] = [];
    SimulaPrivacy.subscribe((s) => seen.push(s.coppaApplies));
    SimulaPrivacy.update({ coppaApplies: true });
    await new Promise((r) => setTimeout(r, 350));
    expect(seen).toEqual([true]);
  });

  it('a broken subscriber cannot break the SDK', async () => {
    SimulaPrivacy.subscribe(() => {
      throw new Error('host bug');
    });
    expect(() => SimulaPrivacy.update({ coppaApplies: true })).not.toThrow();
    await new Promise((r) => setTimeout(r, 350));
  });
});
