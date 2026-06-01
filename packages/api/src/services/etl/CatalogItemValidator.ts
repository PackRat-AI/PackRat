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
const PRIVATE_HOSTNAME_PATTERN =
  /^(?:localhost|127\.|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|169\.254\.|::1$|fc00:|fd00:|fe80:)/i;

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

// IPv4-mapped IPv6 prefix, e.g. `::ffff:127.0.0.1` or its normalized hex form
// `::ffff:7f00:1`, and the `::ffff:0:…` variant. `URL.hostname` collapses the
// dotted tail into two hex groups, so we must accept both textual and hex tails.
// Matches the prefix and captures whatever follows it (one or two hex groups, or
// a dotted-quad), case-insensitively.
const IPV4_MAPPED_IPV6_PATTERN = /^::ffff:(?:0:)?([0-9a-f.:]+)$/i;
// Hoisted to top level (lint/performance/useTopLevelRegex) — used per-octet/group
// inside extractMappedIpv4's hot path.
const IPV4_OCTET_PATTERN = /^\d{1,3}$/;
const IPV6_HEX_GROUP_PATTERN = /^[0-9a-f]{1,4}$/i;

/**
 * If `hostname` is an IPv4-mapped IPv6 address (`::ffff:…` / `::ffff:0:…`, in
 * either dotted `::ffff:127.0.0.1` or hex `::ffff:7f00:1` form), returns the
 * embedded dotted-quad IPv4 string (e.g. `127.0.0.1`). Otherwise returns null.
 *
 * This lets the existing IPv4 private/loopback/link-local/CGNAT ranges be
 * re-applied to addresses that would otherwise slip through as opaque IPv6 hex.
 */
function extractMappedIpv4(hostname: string): string | null {
  const match = IPV4_MAPPED_IPV6_PATTERN.exec(hostname);
  if (!match) return null;
  const tail = match[1];

  // Already a dotted quad (e.g. `::ffff:127.0.0.1`).
  if (tail.includes('.')) {
    const octets = tail.split('.');
    if (octets.length !== 4) return null;
    if (octets.some((o) => o === '' || !IPV4_OCTET_PATTERN.test(o) || Number(o) > 255)) return null;
    return octets.join('.');
  }

  // Hex form: one or two 16-bit groups (e.g. `7f00:1` → 127.0.0.1, or `1` → 0.0.0.1).
  const groups = tail.split(':');
  if (groups.length > 2 || groups.some((g) => g === '' || !IPV6_HEX_GROUP_PATTERN.test(g))) {
    return null;
  }
  // Combine into a single 32-bit value: high group is the upper 16 bits.
  const high = groups.length === 2 ? Number.parseInt(groups[0], 16) : 0;
  const low = Number.parseInt(groups[groups.length - 1], 16);
  if (Number.isNaN(high) || Number.isNaN(low) || high > 0xffff || low > 0xffff) return null;
  const value = (high << 16) | low;
  return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff].join(
    '.',
  );
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
    if (PRIVATE_HOSTNAME_PATTERN.test(hostname)) {
      return 'Product URL hostname must not be a private/loopback/link-local address';
    }

    // IPv4-mapped IPv6 (`::ffff:127.0.0.1`) normalizes to hex (`::ffff:7f00:1`)
    // in URL.hostname, matching neither the IPv4 nor the IPv6 branches above.
    // Extract the embedded IPv4 and re-test it so mapped forms can't bypass the
    // private/loopback/link-local/CGNAT ranges.
    const mappedIpv4 = extractMappedIpv4(hostname);
    if (mappedIpv4 !== null && PRIVATE_HOSTNAME_PATTERN.test(mappedIpv4)) {
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
