/**
 * Utility to infer image extensions from URLs or fetch them when not available
 */

import { getDomainSpecificExtension } from './domain-specific-extensions';

/**
 * Attempts to infer the image extension from a URL
 * @param url The image URL
 * @returns The inferred extension or null if it couldn't be determined
 */
export const inferImageExtension = (url: string): string | null => {
  // Check if URL already has an extension
  const extensionMatch = url.match(/\.(jpe?g|png|gif|webp|avif|svg)($|\?)/i);
  if (extensionMatch) {
    return extensionMatch[1].toLowerCase();
  }

  // Check domain-specific patterns
  const domainExt = getDomainSpecificExtension(url);
  if (domainExt) {
    return domainExt;
  }

  // For URLs that don't include extensions, we'll need to fetch headers
  return null;
};

/**
 * Fetches the content type of a URL to determine its image type
 * @param url The image URL
 * @returns A promise resolving to the extension or null if it couldn't be determined
 */
export const fetchImageExtension = async (url: string): Promise<string | null> => {
  try {
    // First try to infer from URL
    const inferredExt = inferImageExtension(url);
    if (inferredExt) return inferredExt;

    // Create an AbortController for timeout to avoid hang
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout

    try {
      // Try HEAD request first with timeout
      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType) {
          // Map content type to extension
          const contentTypeMap: Record<string, string> = {
            'image/jpeg': 'jpg',
            'image/jpg': 'jpg',
            'image/png': 'png',
            'image/gif': 'gif',
            'image/webp': 'webp',
            'image/avif': 'avif',
            'image/svg+xml': 'svg',
          };

          return contentTypeMap[contentType] || null;
        }
      }
    } catch (headError) {
      // HEAD request failed or timed out, we'll try a small GET request next
      console.log('HEAD request failed, trying GET with range:', headError);
    } finally {
      clearTimeout(timeoutId);
    }

    // If HEAD failed, try a small range GET request
    const rangeController = new AbortController();
    const rangeTimeoutId = setTimeout(() => rangeController.abort(), 3000);

    try {
      // Request just the first 1024 bytes to check headers
      const rangeResponse = await fetch(url, {
        headers: { Range: 'bytes=0-1023' },
        signal: rangeController.signal,
      });

      clearTimeout(rangeTimeoutId);

      if (rangeResponse.ok || rangeResponse.status === 206) {
        const contentType = rangeResponse.headers.get('content-type');
        if (contentType) {
          const contentTypeMap: Record<string, string> = {
            'image/jpeg': 'jpg',
            'image/jpg': 'jpg',
            'image/png': 'png',
            'image/gif': 'gif',
            'image/webp': 'webp',
            'image/avif': 'avif',
            'image/svg+xml': 'svg',
          };

          return contentTypeMap[contentType] || null;
        }
      }
    } catch (rangeError) {
      console.log('Range GET request failed:', rangeError);
    } finally {
      clearTimeout(rangeTimeoutId);
    }

    // All requests failed and we couldn't determine the extension
    return null;
  } catch (error) {
    console.error('Error fetching image extension:', error);
    return null;
  }
};

/**
 * Retrieves the file extension of an image from its URL.
 * @param url The original image URL
 * @param defaultExt The default extension to use if we can't determine one
 * @returns A promise resolving to the extension
 */
export const getImageExtension = async (url: string, defaultExt = 'jpg'): Promise<string> => {
  // First check if URL already has an extension
  const inferredExt = inferImageExtension(url);
  if (inferredExt) return inferredExt;

  try {
    // Try to fetch the extension with timeout
    const fetchPromise = fetchImageExtension(url);
    const timeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), 5000); // 5 second total timeout
    });

    // Race the fetch against the timeout
    const fetchedExt = await Promise.race([fetchPromise, timeoutPromise]);

    // If we got an extension, append it to the URL
    if (fetchedExt) {
      return fetchedExt;
    }
  } catch (error) {
    console.warn('Error in getImageUrlWithExtension:', error);
  }

  // Fall back to default extension
  return defaultExt;
};
