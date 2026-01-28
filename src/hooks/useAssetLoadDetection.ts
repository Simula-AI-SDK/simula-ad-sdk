import { useState, useEffect, RefObject } from 'react';

interface AssetLoadResult {
  isLoaded: boolean;
}

const ASSET_LOAD_TIMEOUT_MS = 5000;
const LAYOUT_STABILITY_MS = 50;

/**
 * Hook to detect when a container's content has fully loaded and layout is stable.
 *
 * Two-phase detection:
 * 1. Wait for all images to load (or error/timeout)
 * 2. Wait for layout to stabilize (no resize events for LAYOUT_STABILITY_MS)
 */
export function useAssetLoadDetection(
  containerRef: RefObject<HTMLElement>,
  enabled: boolean
): AssetLoadResult {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!enabled || !containerRef.current) {
      return;
    }

    const container = containerRef.current;
    const trackedImages = new Set<HTMLImageElement>();
    let loadedCount = 0;
    let isComplete = false;
    let hasScannedAfterRender = false;
    let imagesReady = false;
    let resizeObserver: ResizeObserver | null = null;
    let stabilityTimeoutId: ReturnType<typeof setTimeout> | null = null;

    const markComplete = () => {
      if (isComplete) return;
      isComplete = true;
      setIsLoaded(true);
      if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
      }
      if (stabilityTimeoutId) {
        clearTimeout(stabilityTimeoutId);
        stabilityTimeoutId = null;
      }
    };

    const startLayoutStabilityCheck = () => {
      if (isComplete) return;
      imagesReady = true;

      resizeObserver = new ResizeObserver((entries) => {
        if (isComplete) return;
        const entry = entries[0];
        const height = entry.contentRect.height;

        if (stabilityTimeoutId) {
          clearTimeout(stabilityTimeoutId);
        }

        if (height > 0) {
          stabilityTimeoutId = setTimeout(() => {
            markComplete();
          }, LAYOUT_STABILITY_MS);
        }
      });

      resizeObserver.observe(container);
    };

    const checkImagesComplete = () => {
      if (isComplete || imagesReady) return;
      if (!hasScannedAfterRender) return;

      const total = trackedImages.size;

      if (total === 0 || loadedCount >= total) {
        startLayoutStabilityCheck();
      }
    };

    const handleImageLoad = (img: HTMLImageElement) => {
      if (trackedImages.has(img) && !imagesReady) {
        loadedCount++;
        checkImagesComplete();
      }
    };

    const handleImageError = (img: HTMLImageElement) => {
      if (trackedImages.has(img) && !imagesReady) {
        loadedCount++;
        checkImagesComplete();
      }
    };

    const trackImage = (img: HTMLImageElement) => {
      if (trackedImages.has(img)) return;

      trackedImages.add(img);

      if (img.complete && img.naturalWidth > 0) {
        loadedCount++;
      } else if (img.complete && img.naturalWidth === 0) {
        loadedCount++;
      } else {
        img.addEventListener('load', () => handleImageLoad(img), { once: true });
        img.addEventListener('error', () => handleImageError(img), { once: true });
      }
    };

    const scanForImages = () => {
      const images = container.querySelectorAll('img');
      images.forEach((img) => trackImage(img));
    };

    const mutationObserver = new MutationObserver((mutations) => {
      if (imagesReady) return;
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLImageElement) {
            trackImage(node);
          } else if (node instanceof HTMLElement) {
            node.querySelectorAll('img').forEach((img) => trackImage(img));
          }
        });
      });
      checkImagesComplete();
    });

    mutationObserver.observe(container, {
      childList: true,
      subtree: true,
    });

    // Double-rAF to wait for React to commit the render AND paint
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (isComplete) return;
        scanForImages();
        hasScannedAfterRender = true;
        checkImagesComplete();
      });
    });

    const timeoutId = setTimeout(() => {
      if (!isComplete) {
        markComplete();
      }
    }, ASSET_LOAD_TIMEOUT_MS);

    return () => {
      mutationObserver.disconnect();
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (stabilityTimeoutId) {
        clearTimeout(stabilityTimeoutId);
      }
      clearTimeout(timeoutId);
      trackedImages.clear();
    };
  }, [containerRef, enabled]);

  return { isLoaded };
}
