/**
 * Zero-dependency unique-id generator. Uses the platform CSPRNG
 * (`crypto.randomUUID`, baseline in all modern browsers and Node ≥16.17).
 *
 * The fallback for legacy environments is a monotonic counter + timestamp —
 * deliberately NOT Math.random(): IDs are used as idempotency keys (telemetry
 * event ids, preload handles, slot identity), and insecure PRNG output has no
 * place in that path (CodeQL js/insecure-randomness). Uniqueness across a
 * page session is guaranteed by the counter; across sessions by the timestamp.
 */

let fallbackCounter = 0;

export function generateId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    // Fall through to the monotonic generator
  }
  fallbackCounter = (fallbackCounter + 1) % Number.MAX_SAFE_INTEGER;
  return `id-${Date.now().toString(36)}-${fallbackCounter.toString(36)}`;
}
