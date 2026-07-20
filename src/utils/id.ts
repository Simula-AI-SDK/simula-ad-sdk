/**
 * Zero-dependency unique-id generator. Prefers the platform CSPRNG
 * (`crypto.randomUUID`, baseline in all modern browsers) and falls back to a
 * Math.random UUIDv4-shape when unavailable. IDs are used for slot identity
 * only — uniqueness matters, cryptographic strength does not.
 */
export function generateId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    // Fall through to the manual generator
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
