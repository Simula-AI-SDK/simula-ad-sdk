/**
 * Live network-connection-type signal for the `X-Connection-Type` request
 * header (OpenRTB `device.connectiontype` enum) and telemetry's
 * `connection_type` label. Web port of the native `SimulaConnectionType`.
 *
 * Browsers expose this via `navigator.connection` (Network Information API —
 * Chromium only; Safari/Firefox omit the value, which is the documented
 * "unknown" contract). A single `change` listener keeps the value fresh;
 * the request path reads a cached int with zero per-request cost.
 *
 * OpenRTB `connectiontype`: `0` unknown/offline · `1` wired · `2` wifi ·
 * `3` cellular (unknown gen) · `4` 2G · `5` 3G · `6` 4G · `7` 5G.
 */

/** Pure mapping (NetworkInformation {type, effectiveType} → OpenRTB), exported for tests. */
export function classifyConnection(type?: string, effectiveType?: string): number {
  if (type === 'wifi') return 2;
  if (type === 'ethernet') return 1;
  if (type === 'cellular') {
    // Refine the cellular generation from effectiveType when available
    switch (effectiveType) {
      case 'slow-2g':
      case '2g':
        return 4;
      case '3g':
        return 5;
      case '4g':
        return 6;
      default:
        return 3;
    }
  }
  // No explicit type: an effectiveType alone still implies cellular-ish radio
  switch (effectiveType) {
    case 'slow-2g':
    case '2g':
      return 4;
    case '3g':
      return 5;
    case '4g':
      return 6;
    default:
      return 0;
  }
}

let value = 0;
let primed = false;

function read(): void {
  try {
    const conn = (typeof navigator !== 'undefined' ? (navigator as any).connection : undefined) as
      | { type?: string; effectiveType?: string }
      | undefined;
    if (!conn) return;
    value = classifyConnection(conn.type, conn.effectiveType);
  } catch {
    // Signal omitted on failure — never fatal
  }
}

/** Idempotent. Seeds the value and attaches the change listener. */
export function primeConnectionType(): void {
  if (primed || typeof navigator === 'undefined') return;
  primed = true;
  try {
    read();
    const conn = (navigator as any).connection;
    if (conn && typeof conn.addEventListener === 'function') {
      conn.addEventListener('change', read);
    }
  } catch {
    // Best-effort signal
  }
}

/** The current OpenRTB `connectiontype` value (0 until primed/unsupported). */
export function connectionTypeValue(): number {
  return value;
}

/** Coarse label (`wifi` | `cellular` | `unknown`) for telemetry's `connection_type`. */
export function connectionTypeLabel(): string {
  if (value === 1 || value === 2) return 'wifi';
  if (value >= 3 && value <= 7) return 'cellular';
  return 'unknown';
}

/** Test hook. Not public API. */
export function _resetConnectionTypeForTests(): void {
  value = 0;
  primed = false;
}
