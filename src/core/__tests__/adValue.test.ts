import { describe, it, expect } from 'vitest';
import { adValueFromBidCpm } from '../adValue';

describe('adValueFromBidCpm (native parity: AdValue.fromBidCpm)', () => {
  it('derives all figures from a single valueMicros', () => {
    // $5.00 CPM → 5000 micros → $0.005 per impression
    expect(adValueFromBidCpm(5.0)).toEqual({
      valueMicros: 5000,
      currencyCode: 'USD',
      precisionType: 'ESTIMATED',
      expectedCpm: 5,
      expectedRevenue: 0.005,
    });
  });

  it('rounds to the nearest micro', () => {
    expect(adValueFromBidCpm(1.2345).valueMicros).toBe(1235); // 1234.5 → 1235
  });

  it('clamps negative bids to 0', () => {
    expect(adValueFromBidCpm(-3).valueMicros).toBe(0);
  });

  it('clamps non-finite bids to 0', () => {
    expect(adValueFromBidCpm(NaN).valueMicros).toBe(0);
    expect(adValueFromBidCpm(Infinity).valueMicros).toBe(0);
  });

  it('accepts a currency override', () => {
    expect(adValueFromBidCpm(2, 'EUR').currencyCode).toBe('EUR');
  });
});
