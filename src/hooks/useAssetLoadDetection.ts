import { useState, useEffect, RefObject } from 'react';

interface AssetLoadResult {
  isLoaded: boolean;
}

const ASSET_LOAD_TIMEOUT_MS = 5000; // 5 second max wait for assets
const LAYOUT_STABILITY_MS = 50; // Wait for layout to stabilize after last resize

/**
 * Hook to detect when a container's content has fully loaded and layout is stable.
 *
 * Two-phase detection:
 * 1. Wait for all images to load (or error/timeout)
 * 2. Wait for layout to stabilize (no resize events for LAYOUT_STABILITY_MS)
 *
 * @param containerRef - Ref to the container element to watch
 * @param enabled - Whether to enable detection (typically when ad HTML is present)
 * @returns Object with isLoaded boolean
 */
export function useAssetLoadDetection(
  containerRef: RefObject<HTMLElement>,
  enabled: boolean
): AssetLoadResult {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    console.log('[useAssetLoadDetection] Effect running, enabled:', enabled, 'containerRef.current:', !!containerRef.current);

    if (!enabled || !containerRef.current) {
      console.log('[useAssetLoadDetection] Early return - not enabled or no container');
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
      console.log('[useAssetLoadDetection] Marking as complete - layout stable');
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
      console.log('[useAssetLoadDetection] Images ready, starting layout stability check');
      imagesReady = true;

      // Start ResizeObserver to wait for layout to stabilize
      resizeObserver = new ResizeObserver((entries) => {
        if (isComplete) return;
        const entry = entries[0];
        const height = entry.contentRect.height;
        console.log('[useAssetLoadDetection] ResizeObserver: height =', height);

        // Reset stability timer on each resize
        if (stabilityTimeoutId) {
          clearTimeout(stabilityTimeoutId);
        }

        // If height > 0, start stability countdown
        if (height > 0) {
          stabilityTimeoutId = setTimeout(() => {
            console.log('[useAssetLoadDetection] Layout stable for', LAYOUT_STABILITY_MS, 'ms');
            markComplete();
          }, LAYOUT_STABILITY_MS);
        }
      });

      resizeObserver.observe(container);
    };

    const checkImagesComplete = () => {
      if (isComplete || imagesReady) return;

      // Don't check until we've scanned after React's render commit
      if (!hasScannedAfterRender) {
        console.log('[useAssetLoadDetection] checkImagesComplete - waiting for post-render scan');
        return;
      }

      const total = trackedImages.size;
      console.log('[useAssetLoadDetection] checkImagesComplete - total:', total, 'loadedCount:', loadedCount);

      // No images to load - start layout check immediately
      if (total === 0) {
        console.log('[useAssetLoadDetection] No images found, starting layout check');
        startLayoutStabilityCheck();
        return;
      }

      // All images loaded - start layout check
      if (loadedCount >= total) {
        console.log('[useAssetLoadDetection] All images loaded, starting layout check');
        startLayoutStabilityCheck();
      }
    };

    const handleImageLoad = (img: HTMLImageElement) => {
      if (trackedImages.has(img) && !imagesReady) {
        loadedCount++;
        console.log('[useAssetLoadDetection] Image loaded:', img.src, 'loadedCount:', loadedCount);
        checkImagesComplete();
      }
    };

    const handleImageError = (img: HTMLImageElement) => {
      // Count errors as "loaded" to prevent infinite waiting
      if (trackedImages.has(img) && !imagesReady) {
        loadedCount++;
        console.log('[useAssetLoadDetection] Image error:', img.src, 'loadedCount:', loadedCount);
        checkImagesComplete();
      }
    };

    const trackImage = (img: HTMLImageElement) => {
      if (trackedImages.has(img)) return;

      trackedImages.add(img);
      console.log('[useAssetLoadDetection] Tracking image:', img.src, 'complete:', img.complete, 'naturalWidth:', img.naturalWidth);

      // Image may already be loaded (cached)
      if (img.complete && img.naturalWidth > 0) {
        console.log('[useAssetLoadDetection] Image already loaded (cached):', img.src);
        loadedCount++;
      } else if (img.complete && img.naturalWidth === 0) {
        // Image failed to load (broken)
        console.log('[useAssetLoadDetection] Image already failed (broken):', img.src);
        loadedCount++;
      } else {
        console.log('[useAssetLoadDetection] Adding load/error listeners for:', img.src);
        img.addEventListener('load', () => handleImageLoad(img), { once: true });
        img.addEventListener('error', () => handleImageError(img), { once: true });
      }
    };

    const scanForImages = () => {
      const images = container.querySelectorAll('img');
      console.log('[useAssetLoadDetection] Scanning for images, found:', images.length);
      images.forEach((img) => trackImage(img));
    };

    // Watch for dynamically added images
    const mutationObserver = new MutationObserver((mutations) => {
      if (imagesReady) return; // Stop tracking new images once we're in layout phase
      console.log('[useAssetLoadDetection] MutationObserver triggered, mutations:', mutations.length);
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLImageElement) {
            console.log('[useAssetLoadDetection] New img element added:', node.src);
            trackImage(node);
          } else if (node instanceof HTMLElement) {
            const newImages = node.querySelectorAll('img');
            if (newImages.length > 0) {
              console.log('[useAssetLoadDetection] New element with', newImages.length, 'images added');
            }
            newImages.forEach((img) => trackImage(img));
          }
        });
      });
      checkImagesComplete();
    });

    mutationObserver.observe(container, {
      childList: true,
      subtree: true,
    });

    // Use double-rAF to wait for React to commit the render AND paint
    // First rAF: scheduled during current frame
    // Second rAF: runs after paint, when dangerouslySetInnerHTML is definitely in DOM
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (isComplete) return; // Already completed
        console.log('[useAssetLoadDetection] Post-render scan (double-rAF)');
        scanForImages();
        hasScannedAfterRender = true;
        checkImagesComplete();
      });
    });

    // Timeout fallback - don't wait forever
    const timeoutId = setTimeout(() => {
      if (!isComplete) {
        console.log('[useAssetLoadDetection] Timeout reached, forcing loaded state');
        markComplete();
      }
    }, ASSET_LOAD_TIMEOUT_MS);

    return () => {
      console.log('[useAssetLoadDetection] Cleanup');
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

  // Reset when disabled
  useEffect(() => {
    if (!enabled) {
      console.log('[useAssetLoadDetection] Disabled, resetting isLoaded to false');
      setIsLoaded(false);
    }
  }, [enabled]);

  console.log('[useAssetLoadDetection] Returning isLoaded:', isLoaded);
  return { isLoaded };
}
