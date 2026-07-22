import { describe, it, expect, beforeEach, vi } from 'vitest';
import { preloadImage, preloadImages, _resetImagePreloaderForTests } from '../imagePreloader';

// Minimal Image stub: records src assignments, fires onload async
function stubImage(behavior: 'load' | 'error' = 'load') {
  const instances: { src: string; onload: (() => void) | null; onerror: (() => void) | null }[] = [];
  class FakeImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(url: string) {
      instances.push({ src: url, onload: this.onload, onerror: this.onerror });
      setTimeout(() => {
        if (behavior === 'load') this.onload?.();
        else this.onerror?.();
      }, 0);
    }
  }
  vi.stubGlobal('Image', FakeImage as any);
  return instances;
}

describe('imagePreloader (in-flight dedup)', () => {
  beforeEach(() => {
    _resetImagePreloaderForTests();
    vi.unstubAllGlobals();
  });

  it('dedupes concurrent preloads of the same URL', async () => {
    const instances = stubImage();
    await Promise.all([preloadImage('https://cdn.test/a.png'), preloadImage('https://cdn.test/a.png'), preloadImage('https://cdn.test/a.png')]);
    expect(instances).toHaveLength(1);
  });

  it('short-circuits already-warmed URLs', async () => {
    const instances = stubImage();
    await preloadImage('https://cdn.test/a.png');
    await preloadImage('https://cdn.test/a.png');
    expect(instances).toHaveLength(1);
  });

  it('fetches distinct URLs in parallel', async () => {
    const instances = stubImage();
    await preloadImages(['https://cdn.test/a.png', 'https://cdn.test/b.png']);
    expect(instances).toHaveLength(2);
  });

  it('failures never reject and stay retryable', async () => {
    let instances = stubImage('error');
    await expect(preloadImage('https://cdn.test/a.png')).resolves.toBeUndefined();

    vi.unstubAllGlobals();
    instances = stubImage('load');
    await preloadImage('https://cdn.test/a.png'); // retried (not cached as failed)
    expect(instances).toHaveLength(1);
  });

  it('empty url is a no-op', async () => {
    const instances = stubImage();
    await preloadImage('');
    expect(instances).toHaveLength(0);
  });
});
