import { describe, it, expect, beforeEach } from 'vitest';
import { SimulaStorage } from '../storage';

// Node test env has no window.localStorage → exercises the in-memory
// fallback path (same path Safari private mode takes in production).
describe('SimulaStorage', () => {
  beforeEach(() => {
    SimulaStorage._resetForTests();
  });

  it('sets, gets and removes values', () => {
    expect(SimulaStorage.get('k1')).toBeNull();
    SimulaStorage.set('k1', 'v1');
    expect(SimulaStorage.get('k1')).toBe('v1');
    SimulaStorage.remove('k1');
    expect(SimulaStorage.get('k1')).toBeNull();
  });

  it('round-trips JSON values', () => {
    SimulaStorage.setJSON('obj', { a: 1, b: ['x'] });
    expect(SimulaStorage.getJSON('obj')).toEqual({ a: 1, b: ['x'] });
  });

  it('returns null for invalid JSON', () => {
    SimulaStorage.set('bad', '{not json');
    expect(SimulaStorage.getJSON('bad')).toBeNull();
  });

  it('is not persistent without localStorage (memory fallback)', () => {
    expect(SimulaStorage.isPersistent()).toBe(false);
    SimulaStorage.set('k', 'v');
    expect(SimulaStorage.get('k')).toBe('v');
  });

  it('consent gate forces in-memory storage', () => {
    SimulaStorage.setLocalStorageAllowed(false);
    expect(SimulaStorage.isPersistent()).toBe(false);
    SimulaStorage.set('k2', 'v2');
    expect(SimulaStorage.get('k2')).toBe('v2');
    SimulaStorage.setLocalStorageAllowed(true);
  });
});
