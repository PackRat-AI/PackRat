// Validator hardening tests — closes audit P3 #2 (the user-facing catalog
// rendered any URL that new URL() accepted, including javascript: and
// private IPs). These tests pin the new scheme / hostname / length
// constraints so the attack surface cannot regress.

import { CatalogItemValidator } from '@packrat/api/services/etl/CatalogItemValidator';
import { describe, expect, it } from 'vitest';

const baseItem = {
  name: 'Test Item',
  sku: 'SKU-1',
  productUrl: 'https://example.com/product/1',
};

function reasonsFor(field: string, errors: { field: string; reason: string }[]): string[] {
  return errors.filter((e) => e.field === field).map((e) => e.reason);
}

describe('CatalogItemValidator', () => {
  const v = new CatalogItemValidator();

  describe('URL scheme', () => {
    it('accepts http and https URLs', () => {
      const httpsOk = v.validateItem({ ...baseItem, productUrl: 'https://example.com/x' });
      expect(httpsOk.isValid).toBe(true);

      const httpOk = v.validateItem({ ...baseItem, productUrl: 'http://example.com/x' });
      expect(httpOk.isValid).toBe(true);
    });

    it('rejects javascript:, mailto:, data:, file: URLs', () => {
      for (const url of [
        'javascript:alert(1)',
        'mailto:foo@bar',
        'data:text/html,x',
        'file:///etc/passwd',
      ]) {
        const result = v.validateItem({ ...baseItem, productUrl: url });
        expect(result.isValid).toBe(false);
        expect(reasonsFor('productUrl', result.errors).join(' ')).toMatch(/scheme/i);
      }
    });
  });

  describe('URL hostname (SSRF guard)', () => {
    it('rejects loopback hostnames', () => {
      for (const url of [
        'http://localhost/x',
        'http://127.0.0.1/x',
        'http://127.5.5.5/x',
        'http://[::1]/x',
      ]) {
        const result = v.validateItem({ ...baseItem, productUrl: url });
        expect(result.isValid).toBe(false);
        expect(reasonsFor('productUrl', result.errors).join(' ')).toMatch(
          /private|loopback|link-local/i,
        );
      }
    });

    it('rejects RFC-1918 private ranges', () => {
      for (const url of [
        'http://10.0.0.1/x',
        'http://10.255.255.255/x',
        'http://192.168.1.1/x',
        'http://172.16.0.1/x',
        'http://172.31.255.255/x',
      ]) {
        const result = v.validateItem({ ...baseItem, productUrl: url });
        expect(result.isValid).toBe(false);
        expect(reasonsFor('productUrl', result.errors).join(' ')).toMatch(
          /private|loopback|link-local/i,
        );
      }
    });

    it('rejects link-local 169.254/16', () => {
      const result = v.validateItem({ ...baseItem, productUrl: 'http://169.254.169.254/latest' });
      expect(result.isValid).toBe(false);
      expect(reasonsFor('productUrl', result.errors).join(' ')).toMatch(
        /private|loopback|link-local/i,
      );
    });

    it('allows 172.15 and 172.32 (outside the private 16-31 range)', () => {
      const ok1 = v.validateItem({ ...baseItem, productUrl: 'http://172.15.0.1/x' });
      expect(ok1.isValid).toBe(true);
      const ok2 = v.validateItem({ ...baseItem, productUrl: 'http://172.32.0.1/x' });
      expect(ok2.isValid).toBe(true);
    });
  });

  describe('URL length cap', () => {
    it('accepts a URL at the boundary (2048 chars)', () => {
      const path = 'a'.repeat(2048 - 'https://example.com/'.length);
      const url = `https://example.com/${path}`;
      expect(url.length).toBe(2048);
      const result = v.validateItem({ ...baseItem, productUrl: url });
      expect(result.isValid).toBe(true);
    });

    it('rejects a URL of 2049 chars', () => {
      const path = 'a'.repeat(2049 - 'https://example.com/'.length);
      const url = `https://example.com/${path}`;
      const result = v.validateItem({ ...baseItem, productUrl: url });
      expect(result.isValid).toBe(false);
      expect(reasonsFor('productUrl', result.errors).join(' ')).toMatch(/maximum length/i);
    });
  });

  describe('SKU charset and length', () => {
    it('accepts conventional SKUs (letters, digits, _ . / -)', () => {
      const sku = 'ABC_def.123/test-9';
      const result = v.validateItem({ ...baseItem, sku });
      expect(result.isValid).toBe(true);
    });

    it('rejects SKUs with shell metacharacters or HTML', () => {
      for (const sku of ['<script>', 'a"b', "a'b", 'a;b', 'a&b']) {
        const result = v.validateItem({ ...baseItem, sku });
        expect(result.isValid).toBe(false);
        expect(reasonsFor('sku', result.errors).join(' ')).toMatch(/invalid characters/i);
      }
    });

    it('rejects SKUs over 200 chars', () => {
      const result = v.validateItem({ ...baseItem, sku: 'a'.repeat(201) });
      expect(result.isValid).toBe(false);
      expect(reasonsFor('sku', result.errors).join(' ')).toMatch(/maximum length/i);
    });
  });

  describe('Length caps on prose fields', () => {
    it('accepts a 500-char name; rejects 501', () => {
      const ok = v.validateItem({ ...baseItem, name: 'a'.repeat(500) });
      expect(ok.isValid).toBe(true);
      const bad = v.validateItem({ ...baseItem, name: 'a'.repeat(501) });
      expect(bad.isValid).toBe(false);
    });

    it('rejects description over 50,000 chars', () => {
      const result = v.validateItem({ ...baseItem, description: 'a'.repeat(50_001) });
      expect(result.isValid).toBe(false);
      expect(reasonsFor('description', result.errors).join(' ')).toMatch(/maximum length/i);
    });

    it('rejects brand over 200 chars', () => {
      const result = v.validateItem({ ...baseItem, brand: 'a'.repeat(201) });
      expect(result.isValid).toBe(false);
      expect(reasonsFor('brand', result.errors).join(' ')).toMatch(/maximum length/i);
    });

    it('rejects an oversized category', () => {
      const result = v.validateItem({ ...baseItem, categories: ['ok', 'a'.repeat(201)] });
      expect(result.isValid).toBe(false);
      expect(reasonsFor('categories', result.errors).join(' ')).toMatch(/maximum length/i);
    });
  });
});
