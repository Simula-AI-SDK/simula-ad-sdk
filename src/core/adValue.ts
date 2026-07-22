/**
 * Estimated per-impression revenue for a served ad, in the standard `AdValue`
 * shape (drop-in for a publisher's analytics/MMP pipeline). Mirrors `AdValue`
 * in the Kotlin and Swift SDKs — surfaced on the **paid** callback at the
 * moment the impression fires, never at load.
 *
 * The backend ships the bid (CPM) with the ad (`bid_amt`) and the SDK derives
 * the whole block once, on-device, with no network round-trip. All figures
 * are estimates known at serve time.
 */
export interface AdValue {
  /** Canonical estimate: per-impression revenue in micros of `currencyCode`. `5000` = $0.005. */
  valueMicros: number;
  /** ISO-4217 currency code, e.g. "USD". */
  currencyCode: string;
  /** Estimate quality. Always 'ESTIMATED' for now (backend-provided). */
  precisionType: 'ESTIMATED';
  /** Estimated CPM = valueMicros / 1_000. */
  expectedCpm: number;
  /** Estimated per-impression revenue = valueMicros / 1_000_000. */
  expectedRevenue: number;
}

/**
 * Builds an AdValue from the backend-provided `bid_amt` (estimated CPM).
 * All three figures derive from a single valueMicros so they can never
 * disagree on rounding: `valueMicros = round(bidCpm × 1000)`.
 *
 * Tolerant by construction (native parity): a non-finite or negative bid is
 * clamped to 0 — a missing/garbage field yields a $0 AdValue rather than
 * throwing. Surfacing the paid event must never crash the host.
 */
export function adValueFromBidCpm(bidCpm: number, currencyCode = 'USD'): AdValue {
  const safeBid = Number.isFinite(bidCpm) && bidCpm > 0 ? bidCpm : 0;
  const valueMicros = Math.round(safeBid * 1000);
  return {
    valueMicros,
    currencyCode,
    precisionType: 'ESTIMATED',
    expectedCpm: valueMicros / 1000,
    expectedRevenue: valueMicros / 1_000_000,
  };
}
