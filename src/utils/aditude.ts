/**
 * Aditude utility functions for script injection and ad slot management.
 */

let slotCounter = 0;

/** Generate a unique slot ID for a given prefix (e.g. 'rightrail' → 'rightrail-1') */
export const generateSlotId = (prefix: string): string => {
  slotCounter += 1;
  return `${prefix}-${slotCounter}`;
};

/** Map baseDivId to a human-readable prefix */
export const getSlotPrefix = (baseDivId: string): string => {
  if (baseDivId === '.htlad-anchor') return 'anchor';
  if (baseDivId === '.htlad-medrec') return 'medrec';
  if (baseDivId === '.htlad-rightrail') return 'rightrail';
  return 'slot';
};

/** Inject the Aditude cloud wrapper scripts into document.head. Idempotent. */
export const injectAditudeScript = (scriptUrl: string): void => {
  if (document.querySelector('script[data-simula-aditude]')) return;

  const preload = document.createElement('link');
  preload.rel = 'preload';
  preload.as = 'script';
  preload.href = 'https://www.googletagservices.com/tag/js/gpt.js';
  document.head.prepend(preload);

  const tudeScript = document.createElement('script');
  tudeScript.textContent = 'window.tude = window.tude || { cmd: [] };';
  tudeScript.setAttribute('data-simula-aditude', 'tude');
  document.head.prepend(tudeScript);

  const htlbidScript = document.createElement('script');
  htlbidScript.async = true;
  htlbidScript.src = scriptUrl;
  htlbidScript.setAttribute('data-simula-aditude', 'htlbid');
  document.head.prepend(htlbidScript);
};

/** Call tude.refreshAdsViaDivMappings for a slot. Idempotent per divId. */
export const refreshAdSlot = (
  divId: string,
  baseDivId: string,
  targeting: Record<string, any>
): void => {
  if (!document.querySelector(`script[data-aditude-slot="${divId}"]`)) {
    const script = document.createElement('script');
    script.textContent = `tude.cmd.push(() => tude.refreshAdsViaDivMappings([{ divId: "${divId}", baseDivId: "${baseDivId}", targeting: ${JSON.stringify(targeting)} }]))`;
    script.setAttribute('data-aditude-slot', divId);
    document.body.append(script);
  }
};
