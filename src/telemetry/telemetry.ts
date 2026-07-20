import { API_BASE_URL } from '../utils/api';
import { SDK_VERSION, SDK_HEADER_VALUE } from '../core/version';
import { SimulaStorage } from '../core/storage';
import { SimulaPrivacy, allowsPrimaryUserID } from '../privacy/SimulaPrivacy';
import { SessionManager } from '../core/session';
import { connectionTypeLabel } from '../core/connectionType';
import { generateId } from '../utils/id';
import { logger } from '../utils/logger';

/**
 * Telemetry — web port of the native `Telemetry` / `TelemetryManager`.
 *
 * Pipeline parity contract with the Kotlin/Swift SDKs:
 * - event types: `operation` | `ad_lifecycle` | `error`
 * - batching: flush at 20 events OR every 30s OR eagerly on error
 * - bounds: buffer cap 200 (drop oldest), 50 distinct error signatures
 *   (aggregated via `count`), message/breadcrumb capped at 300 chars, no
 *   query strings in messages/breadcrumbs
 * - durable: the buffer persists via SimulaStorage and is replayed on the
 *   next page load (consent-gated through the storage layer)
 * - server directive: `telemetry_enabled` kill-switch + `telemetry_sample_rate`
 *   from the /session/create response
 * - PII (`primary_user_id`) is re-gated at FLUSH time from the live consent
 *   snapshot — never cached
 * - never throws; telemetry must never crash the host page
 */

// ── Wire shapes (snake_case keys — native parity) ───────────────────────────

export type TelemetryEventType = 'operation' | 'ad_lifecycle' | 'error';

export interface TelemetryEventRecord {
  type: TelemetryEventType;
  name: string;
  event_id: string;
  timestamp: number;
  duration_ms?: number;
  success?: boolean;
  ad_format?: string;
  ad_unit_id?: string;
  ad_id?: string;
  serve_id?: string;
  error_code?: string;
  message?: string;
  breadcrumb?: string;
  trigger?: string;
  cache_source?: string;
  event_age_ms?: number;
  count?: number;
}

interface TelemetryEnvelope {
  sdk_version: string;
  platform: string;
  os_version: string;
  device_model: string;
  host_app_id: string;
  dev_mode: boolean;
  session_id?: string;
  primary_user_id?: string;
  connection_type?: string;
  locale?: string;
  device_ram_mb?: number;
  battery_level?: number;
  battery_charging?: boolean;
  build_type?: string;
  events: TelemetryEventRecord[];
}

// ── Constants (native parity) ───────────────────────────────────────────────

const FLUSH_EVENT_COUNT = 20;
const FLUSH_INTERVAL_MS = 30_000;
const BUFFER_CAP = 200;
const ERROR_SIGNATURE_CAP = 50;
const MESSAGE_CAP = 300;
const STORE_KEY = 'telemetry_buffer';
const VERSION_KEY = 'last_seen_sdk_version';

// ── State ───────────────────────────────────────────────────────────────────

let installed = false;
let enabled = true;
let sampleRate = 1.0;
let sampledIn = true;
let apiKey = '';
let devMode = false;
let buffer: TelemetryEventRecord[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;
let flushing = false;
let flushScheduled = false;
let identityProvider: () => { ppid?: string } = () => ({});

// ── Sanitization ────────────────────────────────────────────────────────────

/** Cap length and strip query strings — no tokens/PII in telemetry text (native rule). */
function sanitize(text: string | undefined): string | undefined {
  if (!text) return undefined;
  let out = text;
  const q = out.indexOf('?');
  if (q >= 0) out = out.slice(0, q);
  if (out.length > MESSAGE_CAP) out = out.slice(0, MESSAGE_CAP);
  return out;
}

// ── Buffer persistence ──────────────────────────────────────────────────────

function persist(): void {
  try {
    SimulaStorage.setJSON(STORE_KEY, buffer);
  } catch {
    // Best-effort
  }
}

function restore(): void {
  try {
    const raw = SimulaStorage.getJSON<TelemetryEventRecord[]>(STORE_KEY);
    if (Array.isArray(raw)) buffer = raw.slice(-BUFFER_CAP);
  } catch {
    buffer = [];
  }
}

// ── Recording ───────────────────────────────────────────────────────────────

/**
 * Schedule an eager flush on the next tick. Deferred (not synchronous) so a
 * burst of events recorded in the same task aggregates in the buffer first —
 * mirrors the native behavior of enqueueing the flush on an IO dispatcher.
 */
function scheduleFlush(): void {
  if (flushScheduled) return;
  flushScheduled = true;
  setTimeout(() => {
    flushScheduled = false;
    void flush();
  }, 0);
}

function push(event: TelemetryEventRecord): void {
  buffer.push(event);
  if (buffer.length > BUFFER_CAP) buffer = buffer.slice(-BUFFER_CAP);
  persist();
  if (event.type === 'error' || buffer.length >= FLUSH_EVENT_COUNT) {
    scheduleFlush(); // eager flush on error / threshold
  }
}

function recordOperation(name: string, opts: { success?: boolean; durationMs?: number; message?: string } = {}): void {
  try {
    if (!installed || !enabled || !sampledIn) return;
    push({
      type: 'operation',
      name,
      event_id: generateId(),
      timestamp: Date.now(),
      success: opts.success,
      duration_ms: opts.durationMs,
      message: sanitize(opts.message),
    });
  } catch {
    // Never fatal
  }
}

export interface LifecycleFields {
  adFormat?: string;
  adUnitId?: string;
  adId?: string;
  serveId?: string;
  durationMs?: number;
  errorCode?: string;
  trigger?: string;
  cacheSource?: string;
  breadcrumb?: string;
}

function recordLifecycle(stage: string, fields: LifecycleFields = {}): void {
  try {
    if (!installed || !enabled || !sampledIn) return;
    push({
      type: 'ad_lifecycle',
      name: stage,
      event_id: generateId(),
      timestamp: Date.now(),
      ad_format: fields.adFormat,
      ad_unit_id: fields.adUnitId,
      ad_id: fields.adId,
      serve_id: fields.serveId,
      duration_ms: fields.durationMs,
      error_code: fields.errorCode,
      trigger: fields.trigger,
      cache_source: fields.cacheSource,
      breadcrumb: sanitize(fields.breadcrumb),
    });
  } catch {
    // Never fatal
  }
}

function recordError(signature: string, opts: { message?: string; breadcrumb?: string } = {}): void {
  try {
    if (!installed || !enabled || !sampledIn) return;
    // Aggregate repeat signatures within the buffer window via `count`
    const existing = buffer.find((e) => e.type === 'error' && e.name === signature);
    if (existing) {
      existing.count = (existing.count ?? 1) + 1;
      persist();
      return;
    }
    const signatureCount = buffer.filter((e) => e.type === 'error').length;
    if (signatureCount >= ERROR_SIGNATURE_CAP) return;
    push({
      type: 'error',
      name: signature,
      event_id: generateId(),
      timestamp: Date.now(),
      message: sanitize(opts.message),
      breadcrumb: sanitize(opts.breadcrumb),
    });
  } catch {
    // Never fatal
  }
}

// ── Envelope ────────────────────────────────────────────────────────────────

function parseOsVersion(ua: string): string {
  try {
    let m = ua.match(/Windows NT ([\d.]+)/);
    if (m) return `Windows ${m[1]}`;
    m = ua.match(/Mac OS X ([\d_]+)/);
    if (m) return `macOS ${m[1].replace(/_/g, '.')}`;
    m = ua.match(/Android ([\d.]+)/);
    if (m) return `Android ${m[1]}`;
    m = ua.match(/OS ([\d_]+)/);
    if (m) return `iOS ${m[1].replace(/_/g, '.')}`;
    if (/Linux/.test(ua)) return 'Linux';
  } catch {
    // fall through
  }
  return 'unknown';
}

function parseDeviceModel(ua: string): string {
  try {
    if (/iPad|Tablet/i.test(ua)) return 'tablet';
    if (/Mobi|Android|iPhone/i.test(ua)) return 'mobile';
    return 'desktop';
  } catch {
    return 'unknown';
  }
}

async function buildEnvelope(events: TelemetryEventRecord[]): Promise<TelemetryEnvelope> {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const snapshot = SimulaPrivacy.current;
  const identity = identityProvider();

  let batteryLevel: number | undefined;
  let batteryCharging: boolean | undefined;
  try {
    const getBattery = typeof navigator !== 'undefined' ? (navigator as any).getBattery : undefined;
    if (typeof getBattery === 'function') {
      const battery = await getBattery.call(navigator);
      if (battery) {
        if (typeof battery.level === 'number') batteryLevel = Math.round(battery.level * 100) / 100;
        if (typeof battery.charging === 'boolean') batteryCharging = battery.charging;
      }
    }
  } catch {
    // Omitted on failure
  }

  let deviceRamMb: number | undefined;
  try {
    const memory = typeof navigator !== 'undefined' ? (navigator as any).deviceMemory : undefined;
    if (typeof memory === 'number' && memory > 0) deviceRamMb = Math.round(memory * 1024);
  } catch {
    // Omitted
  }

  const sessionId = SessionManager.getSessionId();
  // PII re-gated at flush time from the LIVE consent snapshot — never cached
  const ppid = allowsPrimaryUserID(snapshot) ? identity.ppid : undefined;

  return {
    sdk_version: SDK_VERSION,
    platform: 'web',
    os_version: parseOsVersion(ua),
    device_model: parseDeviceModel(ua),
    host_app_id: typeof window !== 'undefined' ? window.location.hostname : '',
    dev_mode: devMode,
    session_id: sessionId,
    primary_user_id: ppid,
    connection_type: connectionTypeLabel(),
    locale: typeof navigator !== 'undefined' ? navigator.language : undefined,
    device_ram_mb: deviceRamMb,
    battery_level: batteryLevel,
    battery_charging: batteryCharging,
    build_type: devMode ? 'debug' : 'release',
    events,
  };
}

// ── Flush ───────────────────────────────────────────────────────────────────

async function flush(keepalive = false): Promise<void> {
  if (!installed || flushing || buffer.length === 0) return;
  flushing = true;
  const now = Date.now();
  const batch = buffer.splice(0, buffer.length);
  const stamped = batch.map((e) => ({ ...e, event_age_ms: now - e.timestamp }));
  try {
    const envelope = await buildEnvelope(stamped);
    const response = await fetch(`${API_BASE_URL}/telemetry/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Simula-SDK': SDK_HEADER_VALUE,
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify(envelope),
      keepalive,
    });
    if (!response.ok) throw new Error(`status ${response.status}`);
    persist(); // buffer (minus flushed) is now durable
  } catch {
    // Restore the batch for the next attempt (cap still applies)
    buffer = [...stamped, ...buffer].slice(-BUFFER_CAP);
    persist();
  } finally {
    flushing = false;
  }
}

function onPageHide(): void {
  if (buffer.length > 0) void flush(true);
}

// ── Public facade ───────────────────────────────────────────────────────────

export const Telemetry = {
  /** Idempotent install. `enabled=false` opts the host out of SDK telemetry entirely. */
  install(opts: { apiKey: string; devMode: boolean; enabled: boolean; identity: () => { ppid?: string } }): void {
    try {
      if (installed) return;
      installed = true;
      apiKey = opts.apiKey;
      devMode = opts.devMode;
      enabled = opts.enabled;
      identityProvider = opts.identity;

      if (!enabled) return;

      restore();

      // sdk_init / sdk_upgrade (native parity: version seen tracking)
      const lastSeen = SimulaStorage.get(VERSION_KEY);
      if (lastSeen !== SDK_VERSION) {
        recordOperation(lastSeen ? 'sdk_upgrade' : 'sdk_init', { success: true });
        SimulaStorage.set(VERSION_KEY, SDK_VERSION);
      } else {
        recordOperation('sdk_init', { success: true });
      }

      flushTimer = setInterval(() => void flush(), FLUSH_INTERVAL_MS);
      if (typeof window !== 'undefined') {
        window.addEventListener('pagehide', onPageHide);
      }
    } catch (error) {
      logger.debug('Telemetry install failed (non-fatal):', error);
    }
  },

  /** Server directive from /session/create: kill-switch + sampling rate. */
  applyServerDirective(serverEnabled?: boolean, serverSampleRate?: number): void {
    try {
      if (serverEnabled === false) {
        enabled = false;
        buffer = [];
        persist();
        return;
      }
      if (typeof serverSampleRate === 'number' && serverSampleRate >= 0 && serverSampleRate <= 1) {
        if (serverSampleRate !== sampleRate) {
          sampleRate = serverSampleRate;
          sampledIn = Math.random() < sampleRate;
        }
      }
    } catch {
      // Best-effort
    }
  },

  recordOperation,
  recordLifecycle,
  recordError,

  /** Force a flush (e.g. on background/unload). */
  flush: (): void => {
    void flush(true);
  },

  /** Test hook. Not public API. */
  _resetForTests(): void {
    installed = false;
    enabled = true;
    sampleRate = 1.0;
    sampledIn = true;
    apiKey = '';
    devMode = false;
    buffer = [];
    flushing = false;
    identityProvider = () => ({});
    flushScheduled = false;
    if (flushTimer !== null) {
      clearInterval(flushTimer);
      flushTimer = null;
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('pagehide', onPageHide);
    }
  },
};
