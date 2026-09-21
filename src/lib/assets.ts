/**
 * Stimulus Asset Resolver & Preloader Engine
 * Target location: src/lib/assets.ts
 */

export const NOTICIA_26_PNG = 'Noticia_26.png';

/**
 * Returns the exact filename for a given stimulus ID.
 * Accurately handles Noticia_26.png vs 2-digit zero-padded Noticia_XX.jpg.
 */
export function getStimulusImageFileName(id: number): string {
  if (id === 26) {
    return NOTICIA_26_PNG;
  }
  const padded = String(id).padStart(2, '0');
  return `Noticia_${padded}.jpg`;
}

/**
 * Returns the public URL path for a stimulus image.
 */
export function getStimulusImagePath(id: number): string {
  return `/noticias/${getStimulusImageFileName(id)}`;
}

/**
 * Returns alternative fallback path in case primary extension fails.
 */
export function getStimulusAlternativePath(id: number): string {
  if (id === 26) {
    return '/noticias/Noticia_26.jpg';
  }
  const padded = String(id).padStart(2, '0');
  return `/noticias/Noticia_${padded}.png`;
}

/**
 * Preloads a single image into the browser cache.
 */
export function preloadSingleImage(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      return resolve(src);
    }
    const img = new Image();
    img.src = src;
    img.onload = () => resolve(src);
    img.onerror = () => reject(new Error(`Failed to load: ${src}`));
  });
}

/**
 * Preloads a list of stimulus IDs concurrently with progress reporting.
 */
export async function preloadStimuliBatch(
  ids: number[],
  onProgress?: (loaded: number, total: number) => void
): Promise<{ successful: number[]; failed: number[] }> {
  const successful: number[] = [];
  const failed: number[] = [];
  let loaded = 0;

  await Promise.all(
    ids.map(async (id) => {
      const primaryUrl = getStimulusImagePath(id);
      try {
        await preloadSingleImage(primaryUrl);
        successful.push(id);
      } catch {
        // Attempt alternative extension
        try {
          const altUrl = getStimulusAlternativePath(id);
          await preloadSingleImage(altUrl);
          successful.push(id);
        } catch {
          failed.push(id);
        }
      } finally {
        loaded++;
        onProgress?.(loaded, ids.length);
      }
    })
  );

  return { successful, failed };
}
