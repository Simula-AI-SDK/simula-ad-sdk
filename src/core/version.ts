/**
 * Single source of truth for SDK identity. Mirrors `SimulaAdSdkInfo` in the
 * Kotlin SDK and `Telemetry.SIMULA_SDK_VERSION` in the Swift SDK — keep in
 * sync with package.json on every release.
 */
export const SDK_NAME = 'simula-ad-sdk-web';
export const SDK_VERSION = '1.4.2-dev.3';

/**
 * Value stamped on every backend request as the `X-Simula-SDK` header.
 * Web equivalent of the native SDKs' custom User-Agent (browsers forbid
 * setting the User-Agent header from fetch).
 */
export const SDK_HEADER_VALUE = `${SDK_NAME}/${SDK_VERSION}`;
