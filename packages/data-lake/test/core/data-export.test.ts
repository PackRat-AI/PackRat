import { existsSync, readFileSync, rmSync } from 'node:fs';
import { DataExporter } from '@packrat/data-lake/core/data-export';
import { afterAll, describe, expect, it } from 'vitest';

const TEST_OUTPUT_DIR = 'data/test-exports';

afterAll(() => {
  rmSync(TEST_OUTPUT_DIR, { recursive: true, force: true });
});

describe('DataExporter', () => {
  it('exports class with expected methods', () => {
    expect(typeof DataExporter.prototype.export).toBe('function');
    expect(typeof DataExporter.prototype.generateSchema).toBe('function');
  });

  describe('generateSchema', () => {
    it('generates valid SQL DDL with expected tables and indexes', () => {
      // generateSchema is pure — no DB connection needed
      const exporter = new DataExporter(null as never);
      const filepath = exporter.generateSchema(TEST_OUTPUT_DIR);

      expect(existsSync(filepath)).toBe(true);

      const sql = readFileSync(filepath, 'utf-8');
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS retailers');
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS brands');
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS categories');
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS products');
      expect(sql).toContain('sku VARCHAR(50) PRIMARY KEY');
      expect(sql).toContain('price_usd DECIMAL(10,2)');
      expect(sql).toContain('quality_score DECIMAL(5,2)');
      expect(sql).toContain('CREATE INDEX IF NOT EXISTS idx_products_price');
      expect(sql).toContain('CREATE OR REPLACE VIEW product_details');
    });
  });
});
