import { describe, it, expect, beforeEach, vi } from 'vitest';
import { validateSimulaProviderProps, validateInChatAdSlotProps, _resetValidationWarningsForTests } from '../validation';
import { generateId } from '../id';
import { logger } from '../logger';

describe('validation re-run + warn-once (PR #12 thread #7)', () => {
  beforeEach(() => {
    _resetValidationWarningsForTests();
  });

  it('re-validation recovers when props become valid (no frozen state)', () => {
    const invalid = validateSimulaProviderProps({ apiKey: 'k', children: null }, false);
    expect(invalid).toBe(false);
    const valid = validateSimulaProviderProps({ apiKey: 'k', children: 'x' }, false);
    expect(valid).toBe(true);
  });

  it('the same failure message logs only once per page', () => {
    const spy = vi.spyOn(logger, 'error').mockImplementation(() => {});
    validateInChatAdSlotProps({ messages: [] }, false);
    validateInChatAdSlotProps({ messages: [] }, false);
    validateInChatAdSlotProps({ messages: [] }, false);
    const emptyMessages = spy.mock.calls.filter((c) => String(c[0]).includes('cannot be an empty array'));
    expect(emptyMessages).toHaveLength(1);
    spy.mockRestore();
  });

  it('different failure messages each log', () => {
    const spy = vi.spyOn(logger, 'error').mockImplementation(() => {});
    validateInChatAdSlotProps({ messages: [] }, false);
    validateInChatAdSlotProps({ messages: 'nope' }, false);
    expect(spy.mock.calls.length).toBe(2);
    spy.mockRestore();
  });

  it('strict mode still throws every time (integration feedback)', () => {
    expect(() => validateSimulaProviderProps({ apiKey: '' }, true)).toThrow();
    expect(() => validateSimulaProviderProps({ apiKey: '' }, true)).toThrow();
  });
});

describe('generateId (PR #12 CodeQL: no insecure randomness)', () => {
  it('produces unique ids via crypto.randomUUID when available', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });

  it('fallback path is monotonic, unique, and never calls Math.random', () => {
    const randomSpy = vi.spyOn(Math, 'random');
    vi.stubGlobal('crypto', undefined); // simulate a legacy environment
    try {
      const a = generateId();
      const b = generateId();
      expect(a).not.toBe(b);
      expect(a).toMatch(/^id-[a-z0-9]+-[a-z0-9]+$/);
      expect(randomSpy).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
      randomSpy.mockRestore();
    }
  });
});
