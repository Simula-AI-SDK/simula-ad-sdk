import { describe, it, expect } from 'vitest';
import { classifyConnection } from '../connectionType';

describe('classifyConnection (OpenRTB mapping)', () => {
  it('maps wifi to 2', () => {
    expect(classifyConnection('wifi', '4g')).toBe(2);
  });

  it('maps ethernet to 1', () => {
    expect(classifyConnection('ethernet')).toBe(1);
  });

  it('refines cellular generations from effectiveType', () => {
    expect(classifyConnection('cellular', 'slow-2g')).toBe(4);
    expect(classifyConnection('cellular', '2g')).toBe(4);
    expect(classifyConnection('cellular', '3g')).toBe(5);
    expect(classifyConnection('cellular', '4g')).toBe(6);
  });

  it('falls back to cellular-unknown-gen (3)', () => {
    expect(classifyConnection('cellular')).toBe(3);
    expect(classifyConnection('cellular', '5g')).toBe(3); // unknown enum → 3
  });

  it('uses effectiveType when type is absent (Chromium desktop)', () => {
    expect(classifyConnection(undefined, '4g')).toBe(6);
    expect(classifyConnection(undefined, '2g')).toBe(4);
  });

  it('returns 0 (unknown) when nothing is available', () => {
    expect(classifyConnection()).toBe(0);
    expect(classifyConnection(undefined, undefined)).toBe(0);
  });
});
