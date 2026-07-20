// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { attachCreativeBridge } from '../creativeBridge';

function makeIframe(): HTMLIFrameElement {
  const iframe = document.createElement('iframe');
  document.body.appendChild(iframe);
  return iframe;
}

function send(iframe: HTMLIFrameElement, data: unknown, source: MessageEventSource | null = iframe.contentWindow) {
  window.dispatchEvent(new MessageEvent('message', { data, source: source as any } as any));
}

describe('creativeBridge (DOM paths)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('routes AD_EARLY_COMPLETE / CTA_CLICK / CREATIVE_MOMENT to handlers', () => {
    const iframe = makeIframe();
    const onEarlyComplete = vi.fn();
    const onCtaClick = vi.fn();
    const onCreativeMoment = vi.fn();
    attachCreativeBridge(iframe, { onEarlyComplete, onCtaClick, onCreativeMoment });

    send(iframe, { type: 'AD_EARLY_COMPLETE' });
    send(iframe, { type: 'CTA_CLICK', payload: { url: 'https://store.test/x' } });
    send(iframe, { type: 'CREATIVE_MOMENT', payload: { moment: 'playable_end' } });

    expect(onEarlyComplete).toHaveBeenCalledTimes(1);
    expect(onCtaClick).toHaveBeenCalledWith('https://store.test/x');
    expect(onCreativeMoment).toHaveBeenCalledWith('playable_end');
  });

  it('replies to GET_* queries with __simulaSdkResponse and the echoed requestId', () => {
    const iframe = makeIframe();
    const posted: any[] = [];
    // Spy on the iframe's contentWindow.postMessage
    const original = iframe.contentWindow!.postMessage.bind(iframe.contentWindow);
    iframe.contentWindow!.postMessage = ((data: any, targetOrigin: string) => {
      posted.push(data);
      return original(data, targetOrigin);
    }) as any;

    attachCreativeBridge(iframe, {});
    send(iframe, { type: 'GET_DEVICE_CONTEXT', requestId: 'req-42' });
    send(iframe, { type: 'GET_AUDIO_STATE', requestId: 7 });
    send(iframe, { type: 'GET_ORIENTATION' });

    expect(posted).toHaveLength(3);
    expect(posted[0]).toMatchObject({ type: 'GET_DEVICE_CONTEXT', requestId: 'req-42', __simulaSdkResponse: true });
    expect(posted[0].payload.platform).toBe('web');
    expect(posted[1]).toMatchObject({ type: 'GET_AUDIO_STATE', requestId: 7, __simulaSdkResponse: true });
    expect(posted[1].payload).toEqual({ muted: null, volume: null });
    expect(posted[2].payload.orientation).toMatch(/portrait|landscape/);
  });

  it('ignores its own reply echoes and non-object/other-source messages', () => {
    const iframe = makeIframe();
    const onEarlyComplete = vi.fn();
    attachCreativeBridge(iframe, { onEarlyComplete });

    send(iframe, { type: 'AD_EARLY_COMPLETE', __simulaSdkResponse: true });
    send(iframe, 'a string, not an envelope');
    send(iframe, { noType: true });
    send(iframe, { type: 'AD_EARLY_COMPLETE' }, window); // wrong source

    expect(onEarlyComplete).not.toHaveBeenCalled();
  });

  it('detach stops routing', () => {
    const iframe = makeIframe();
    const onEarlyComplete = vi.fn();
    const detach = attachCreativeBridge(iframe, { onEarlyComplete });
    detach();
    send(iframe, { type: 'AD_EARLY_COMPLETE' });
    expect(onEarlyComplete).not.toHaveBeenCalled();
  });
});
