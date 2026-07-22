import { describe, it, expect } from 'vitest';
import { SimulaAdError, mapHttpError } from '../errors';

describe('SimulaAdError (cross-platform contract)', () => {
  it('codes are the stable telemetry/JS contract', () => {
    expect(SimulaAdError.notInitialized().code).toBe('not_initialized');
    expect(SimulaAdError.noSession().code).toBe('no_session');
    expect(SimulaAdError.noFill().code).toBe('no_fill');
    expect(SimulaAdError.notReady().code).toBe('not_ready');
    expect(SimulaAdError.stale().code).toBe('stale');
    expect(SimulaAdError.duplicateLoading().code).toBe('duplicate_request');
    expect(SimulaAdError.alreadyShowing().code).toBe('already_showing');
    expect(SimulaAdError.noPresentationContext().code).toBe('no_presentation_context');
    expect(SimulaAdError.network().code).toBe('network');
    expect(SimulaAdError.adUnitNotFound().code).toBe('ad_unit_not_found');
  });

  it('messages are verbatim with the native SDKs', () => {
    expect(SimulaAdError.notInitialized().message).toBe('SimulaAds is not initialized — call SimulaAds.initialize() first.');
    expect(SimulaAdError.noFill().message).toBe('No ad available to show right now (no fill).');
    expect(SimulaAdError.stale().message).toBe('The loaded ad has expired (1 hour limit) and can no longer be shown. Call load() to request a new ad.');
    expect(SimulaAdError.adUnitNotFound().message).toBe('Ad unit id is not registered for this app — check the ad unit id in your Simula dashboard.');
  });

  it('duplicateReady carries structured retryInSeconds', () => {
    const err = SimulaAdError.duplicateReady(240);
    expect(err.code).toBe('duplicate_request');
    expect(err.retryInSeconds).toBe(240);
    expect(err.message).toContain('in 240 seconds');
  });

  it('duplicateLoading has no retry seconds', () => {
    expect(SimulaAdError.duplicateLoading().retryInSeconds).toBeUndefined();
  });

  it('mapHttpError honors the structured backend code', () => {
    expect(mapHttpError(400, { code: 'ad_unit_not_found' }).code).toBe('ad_unit_not_found');
    expect(mapHttpError(404, null).code).toBe('ad_unit_not_found');
    expect(mapHttpError(500, null).code).toBe('network');
    expect(mapHttpError(0, null, new Error('offline')).code).toBe('network');
  });
});
