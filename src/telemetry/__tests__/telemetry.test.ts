import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Telemetry } from '../telemetry';
import { SimulaStorage } from '../../core/storage';
import { SimulaPrivacy } from '../../privacy/SimulaPrivacy';
import { SessionManager } from '../../core/session';

function stubTelemetryFetch() {
  const posts: { url: string; body: any }[] = [];
  const mock = vi.fn(async (input: any, init?: any) => {
    const url = String(input);
    if (url.includes('/telemetry/events')) {
      posts.push({ url, body: JSON.parse(init?.body as string) });
    }
    return { ok: true, status: 200, json: async () => ({}) } as any;
  });
  vi.stubGlobal('fetch', mock);
  return { mock, posts };
}

function install() {
  Telemetry.install({
    apiKey: 'key-1',
    devMode: false,
    enabled: true,
    identity: () => ({ ppid: 'user-1' }),
  });
}

describe('Telemetry', () => {
  beforeEach(() => {
    Telemetry._resetForTests();
    SimulaStorage._resetForTests();
    SimulaPrivacy._resetForTests();
    SessionManager._resetForTests();
    SimulaPrivacy.apply({ hasPrivacyConsent: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('records sdk_init on first install and flushes to /telemetry/events', async () => {
    const { posts } = stubTelemetryFetch();
    install();
    Telemetry.recordError('test:bootstrap'); // eager flush trigger
    await new Promise((r) => setTimeout(r, 20));

    expect(posts).toHaveLength(1);
    const envelope = posts[0].body;
    expect(envelope.sdk_version).toBeTruthy();
    expect(envelope.platform).toBe('web');
    expect(envelope.dev_mode).toBe(false);
    const init = envelope.events.find((e: any) => e.name === 'sdk_init');
    expect(init).toBeDefined();
    expect(init.type).toBe('operation');
  });

  it('records sdk_upgrade when the stored version differs', async () => {
    const { posts } = stubTelemetryFetch();
    SimulaStorage.set('last_seen_sdk_version', '0.0.1');
    install();
    Telemetry.recordError('test:flush');
    await new Promise((r) => setTimeout(r, 20));

    const all = posts.reduce<any[]>((acc, p) => acc.concat(p.body.events), []);
    expect(all.some((e: any) => e.name === 'sdk_upgrade')).toBe(true);
  });

  it('envelope gates primary_user_id on the LIVE consent snapshot', async () => {
    const { posts } = stubTelemetryFetch();
    SimulaPrivacy.apply({ hasPrivacyConsent: false });
    install();
    Telemetry.recordError('test:flush');
    await new Promise((r) => setTimeout(r, 20));
    expect(posts[0].body.primary_user_id).toBeUndefined();

    // Consent granted later → the next flush carries it (re-gated at flush, never cached)
    SimulaPrivacy.update({ hasPrivacyConsent: true });
    Telemetry.recordError('test:flush2');
    await new Promise((r) => setTimeout(r, 20));
    expect(posts[1].body.primary_user_id).toBe('user-1');
  });

  it('aggregates repeated error signatures via count', async () => {
    const { posts } = stubTelemetryFetch();
    install();
    Telemetry.recordError('native:load', { message: 'x' });
    Telemetry.recordError('native:load', { message: 'x' });
    Telemetry.recordError('native:load', { message: 'x' });
    await new Promise((r) => setTimeout(r, 20));

    const all = posts.reduce<any[]>((acc, p) => acc.concat(p.body.events), []);
    const errors = all.filter((e: any) => e.type === 'error' && e.name === 'native:load');
    expect(errors).toHaveLength(1);
    expect(errors[0].count).toBe(3);
  });

  it('strips query strings and caps message length (no PII/tokens)', async () => {
    const { posts } = stubTelemetryFetch();
    install();
    Telemetry.recordError('native:load', { message: `https://api.test/path?token=secret&${'x'.repeat(400)}` });
    await new Promise((r) => setTimeout(r, 20));

    const error = posts[0].body.events.find((e: any) => e.type === 'error');
    expect(error.message).toBe('https://api.test/path');
    expect(error.message.length).toBeLessThanOrEqual(300);
  });

  it('kill-switch (telemetry_enabled=false) clears the buffer and disables', async () => {
    const { posts } = stubTelemetryFetch();
    install();
    Telemetry.recordOperation('session_created', { success: true });
    Telemetry.applyServerDirective(false);
    Telemetry.recordError('test:flush');
    await new Promise((r) => setTimeout(r, 20));
    expect(posts).toHaveLength(0);
  });

  it('sampling rate 0 drops all events', async () => {
    const { posts } = stubTelemetryFetch();
    install();
    Telemetry.applyServerDirective(true, 0);
    Telemetry.recordError('test:flush');
    await new Promise((r) => setTimeout(r, 20));
    expect(posts).toHaveLength(0);
  });

  it('host opt-out (enabled=false) records nothing', async () => {
    const { posts } = stubTelemetryFetch();
    Telemetry.install({ apiKey: 'key-1', devMode: false, enabled: false, identity: () => ({}) });
    Telemetry.recordError('test:flush');
    await new Promise((r) => setTimeout(r, 20));
    expect(posts).toHaveLength(0);
  });

  it('restores events when the flush fails', async () => {    let fail = true;
    const posts: any[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: any, init?: any) => {
        if (String(input).includes('/telemetry/events')) {
          if (fail) throw new Error('offline');
          posts.push(JSON.parse(init?.body as string));
        }
        return { ok: true, status: 200, json: async () => ({}) } as any;
      }),
    );
    install();
    Telemetry.recordError('native:load');
    await new Promise((r) => setTimeout(r, 20));
    expect(posts).toHaveLength(0);

    fail = false;
    Telemetry.recordError('native:load2');
    await new Promise((r) => setTimeout(r, 20));
    const names = posts.reduce<string[]>((acc, p) => acc.concat(p.events.map((e: any) => e.name)), []);
    expect(names).toContain('native:load');
    expect(names).toContain('native:load2');
  });

  it('4xx is permanent: the batch is DROPPED, never retried (no retry-loop spam)', async () => {
    let posts = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: any) => {
        if (String(input).includes('/telemetry/events')) {
          posts++;
          return { ok: false, status: 422, json: async () => ({}) } as any;
        }
        return { ok: true, status: 200, json: async () => ({}) } as any;
      }),
    );
    install();
    Telemetry.recordError('native:load');
    await new Promise((r) => setTimeout(r, 30));
    expect(posts).toBe(1);

    // A later flush must NOT replay the rejected batch — 4xx events are gone
    Telemetry.recordError('native:other');
    await new Promise((r) => setTimeout(r, 30));
    expect(posts).toBe(2);
    const buffer = SimulaStorage.getJSON<any[]>('telemetry_buffer') ?? [];
    const names = buffer.map((e: any) => e.name);
    expect(names).not.toContain('native:load');
  });

  it('stamps event_age_ms at flush time', async () => {
    const { posts } = stubTelemetryFetch();
    install();
    Telemetry.recordError('test:flush');
    await new Promise((r) => setTimeout(r, 20));
    const event = posts[0].body.events.find((e: any) => e.type === 'error');
    expect(typeof event.event_age_ms).toBe('number');
    expect(event.event_age_ms).toBeGreaterThanOrEqual(0);
  });
});
