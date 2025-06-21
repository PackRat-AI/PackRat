/**
 * Domain-specific extension mappings for common image hosts
 * This helps us avoid network requests for known domains
 */

// Update the DomainPattern type to support function-based extension resolution
type DomainPattern = {
  pattern: RegExp;
  extension: string | ((url: string) => string);
};

// Update the domainPatterns array to include Cloudinary
const domainPatterns: DomainPattern[] = [
  // REI product images are typically JPGs
  { pattern: /rei\.com\/media\/product\/\d+$/, extension: 'jpg' },

  // Amazon product images
  { pattern: /amazon\.com\/images\/I\/[A-Za-z0-9]+$/, extension: 'jpg' },

  // Walmart product images
  { pattern: /walmart\.com\/ip\/[A-Za-z0-9-]+\/[0-9]+$/, extension: 'jpeg' },

  // Target product images
  { pattern: /target\.com\/s\/[A-Za-z0-9-]+\/-\/A-\d+$/, extension: 'jpg' },

  // Best Buy product images
  { pattern: /bestbuy\.com\/site\/[A-Za-z0-9-]+\/\d+\.p$/, extension: 'jpg' },

  // Add Cloudinary pattern
  {
    pattern: /cloudinary\.com\/.*\/image\/upload\/.*\/([^/]+)\/(jpe?g|png|gif|webp|avif)\//,
    extension: (url) => {
      const match = url.match(/\/([^/]+)\/(jpe?g|png|gif|webp|avif)\//);
      return match ? match[2].toLowerCase() : 'jpg';
    },
  },

  // Add more patterns as needed
];

/**
 * Checks if a URL matches any known domain patterns and returns the appropriate extension
 * @param url The URL to check
 * @returns The extension if a pattern matches, or null if no pattern matches
 */
export const getDomainSpecificExtension = (url: string): string | null => {
  for (const { pattern, extension } of domainPatterns) {
    if (pattern.test(url)) {
      return typeof extension === 'function' ? extension(url) : extension;
    }
  }
  return null;
};
