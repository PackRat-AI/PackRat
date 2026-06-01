import type { ValidatedCatalogItem } from '@packrat/api/types/etl';
import type { NewCatalogItem } from '@packrat/db';
import { isNumber, isString } from '@packrat/guards';
import type { ValidationError } from '@packrat/schemas/validation';

// Hostname patterns rejected by isValidUrl to close the SSRF surface — any
// future server-side fetch of a catalog URL (OG-tag generation, preview
// rendering, etc.) cannot be tricked into hitting internal infrastructure.
// String-level check only; no DNS resolution (which is itself an SSRF vector).
// IPv6 hostnames are bracket-stripped before matching (URL.hostname returns
// bracketed form: `[::1]`).
// Length caps — chosen to accommodate the widest real-world catalog rows while
// preventing a scraper bug or supply-chain compromise from saturating the
// catalog with multi-MB blobs.
const URL_MAX_LENGTH = 2048;
const NAME_MAX_LENGTH = 500;
const DESCRIPTION_MAX_LENGTH = 50_000;
const BRAND_MAX_LENGTH = 200;
const CATEGORY_MAX_LENGTH = 200;
const SKU_MAX_LENGTH = 200;

const SKU_PATTERN = /^[A-Za-z0-9_./-]+$/;
const IPV6_BRACKET_PATTERN = /^\[(.+)\]$/;

function isPrivateHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (
    lower === 'localhost' ||
    lower.startsWith('127.') ||
    lower.startsWith('10.') ||
    lower.startsWith('192.168.') ||
    lower.startsWith('169.254.')
  ) {
    return true;
  }

  const firstIpv4Octets = lower.split('.').slice(0, 2);
  if (firstIpv4Octets[0] === '172') {
    const secondOctet = Number(firstIpv4Octets[1]);
    if (Number.isInteger(secondOctet) && secondOctet >= 16 && secondOctet <= 31) {
      return true;
    }
  }

  if (lower === '::1') return true;
  const firstHextet = Number.parseInt(lower.split(':')[0] ?? '', 16);
  if (Number.isNaN(firstHextet)) return false;

  return (firstHextet & 0xfe00) === 0xfc00 || (firstHextet & 0xffc0) === 0xfe80;
}

export class CatalogItemValidator {
  validateItem(item: Partial<NewCatalogItem>): ValidatedCatalogItem {
    const errors: ValidationError[] = [];

    // Required field validations
    if (!item.name || !isString(item.name) || item.name.trim().length === 0) {
      errors.push({
        field: 'name',
        reason: 'Name is required and must be a non-empty string',
        value: item.name,
      });
    } else if (item.name.length > NAME_MAX_LENGTH) {
      errors.push({
        field: 'name',
        reason: `Name exceeds maximum length (${NAME_MAX_LENGTH} chars)`,
        value: item.name,
      });
    }

    if (!item.sku || !isString(item.sku) || item.sku.trim().length === 0) {
      errors.push({
        field: 'sku',
        reason: 'SKU is required and must be a non-empty string',
        value: item.sku,
      });
    } else if (item.sku.length > SKU_MAX_LENGTH) {
      errors.push({
        field: 'sku',
        reason: `SKU exceeds maximum length (${SKU_MAX_LENGTH} chars)`,
        value: item.sku,
      });
    } else if (!SKU_PATTERN.test(item.sku)) {
      errors.push({
        field: 'sku',
        reason: 'SKU contains invalid characters (allowed: A-Z a-z 0-9 _ . / -)',
        value: item.sku,
      });
    }

    if (!item.productUrl || !isString(item.productUrl) || item.productUrl.trim().length === 0) {
      errors.push({
        field: 'productUrl',
        reason: 'Product URL is required and must be a non-empty string',
        value: item.productUrl,
      });
    } else if (item.productUrl.length > URL_MAX_LENGTH) {
      errors.push({
        field: 'productUrl',
        reason: `Product URL exceeds maximum length (${URL_MAX_LENGTH} chars)`,
        value: item.productUrl,
      });
    } else {
      const urlError = this.validateUrl(item.productUrl);
      if (urlError) {
        errors.push({ field: 'productUrl', reason: urlError, value: item.productUrl });
      }
    }

    // Additional validations
    // Note: weight and weightUnit are intentionally not required — clothing/footwear brands often
    // omit weight data. Items without weight are ingested but won't appear in weight comparisons.
    if (item.description !== undefined && item.description !== null) {
      if (isString(item.description) && item.description.length > DESCRIPTION_MAX_LENGTH) {
        errors.push({
          field: 'description',
          reason: `Description exceeds maximum length (${DESCRIPTION_MAX_LENGTH} chars)`,
          value: undefined, // omit the raw value — it can be huge
        });
      }
    }

    if (item.brand !== undefined && item.brand !== null) {
      if (isString(item.brand) && item.brand.length > BRAND_MAX_LENGTH) {
        errors.push({
          field: 'brand',
          reason: `Brand exceeds maximum length (${BRAND_MAX_LENGTH} chars)`,
          value: item.brand,
        });
      }
    }

    if (Array.isArray(item.categories)) {
      for (const category of item.categories) {
        if (isString(category) && category.length > CATEGORY_MAX_LENGTH) {
          errors.push({
            field: 'categories',
            reason: `Category exceeds maximum length (${CATEGORY_MAX_LENGTH} chars)`,
            value: category,
          });
          break; // one error is enough; don't spam
        }
      }
    }

    if (item.price !== undefined && (!isNumber(item.price) || item.price < 0)) {
      errors.push({
        field: 'price',
        reason: 'Price must be a non-negative number',
        value: item.price,
      });
    }

    return {
      item,
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Returns null when the URL is acceptable; otherwise a reason string.
   *
   * Rejects:
   * - Non-http(s) schemes (javascript:, mailto:, data:, file:, etc.)
   * - Private/loopback/link-local hostnames (SSRF surface for any future
   *   server-side fetch)
   * - Hostnames containing non-ASCII characters that survive punycode
   *   round-tripping (IDN homograph attack surface for the user-facing
   *   catalog UI)
   */
  private validateUrl(url: string): string | null {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return 'Product URL must be a valid URL format';
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return `Product URL scheme must be http: or https: (got ${parsed.protocol})`;
    }

    // Strip IPv6 brackets so `[::1]` matches the IPv6 patterns and not the
    // bracketed-string fallback.
    const hostname = parsed.hostname.replace(IPV6_BRACKET_PATTERN, '$1');
    if (isPrivateHostname(hostname)) {
      return 'Product URL hostname must not be a private/loopback/link-local address';
    }

    // Hostnames with non-ASCII characters are IDN homograph candidates.
    // Native URL parsing already encodes them to punycode in parsed.hostname,
    // so non-ASCII presence here means the hostname survived encoding (rare)
    // OR the URL was malformed in a way `new URL()` accepted. Either way,
    // reject as a defense-in-depth measure for catalog-rendered links.
    for (const ch of parsed.hostname) {
      if (ch.charCodeAt(0) > 127) {
        return 'Product URL hostname contains non-ASCII characters (IDN homograph guard)';
      }
    }

    return null;
  }
}
