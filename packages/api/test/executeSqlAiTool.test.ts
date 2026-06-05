import { beforeEach, describe, expect, it, vi } from 'vitest';
import { executeSqlAiTool } from '../src/services/executeSqlAiTool';

// Mock the read-only DB so we can control what `.execute` returns. We need
// to drive both the happy path (small result) and the budget-exceeded path
// (synthetic large result) without an actual Postgres roundtrip.
const mockExecute = vi.fn();
vi.mock('../src/db', () => ({
  createReadOnlyDb: () => ({
    execute: mockExecute,
  }),
}));

const TEST_USER_ID = 'test-user-id';

describe('executeSqlAiTool', () => {
  beforeEach(() => {
    mockExecute.mockReset();
  });

  describe('byte-budget guard (U7)', () => {
    it('accepts a small result and reports byteCount', async () => {
      mockExecute.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'tiny' }],
        rowCount: 1,
      });

      const result = await executeSqlAiTool({
        query: 'SELECT id, name FROM users',
        limit: 100,
        userId: TEST_USER_ID,
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual([{ id: 1, name: 'tiny' }]);
      expect(result.byteCount).toBeGreaterThan(0);
      expect(result.byteCount).toBeLessThan(100);
      expect(result.error).toBeUndefined();
    });

    it('rejects a result over the 1 MB budget with actionable error', async () => {
      // Build a synthetic ~1.5 MB result — 1500 rows × ~1 KB string each
      const bigString = 'x'.repeat(1000);
      const bigRows = Array.from({ length: 1500 }, (_, i) => ({
        id: i,
        payload: bigString,
      }));
      mockExecute.mockResolvedValueOnce({
        rows: bigRows,
        rowCount: bigRows.length,
      });

      const result = await executeSqlAiTool({
        query: 'SELECT id, payload FROM big_table',
        limit: 1500,
        userId: TEST_USER_ID,
      });

      expect(result.success).toBeUndefined();
      expect(result.data).toBeUndefined();
      expect(result.error).toContain('budget');
      expect(result.error).toContain('Project specific columns or reduce limit');
      expect(result.byteCount).toBeGreaterThan(1_048_576);
    });

    it('serializes BigInt values (Postgres int8 / COUNT(*)) as strings', async () => {
      // Neon HTTP driver returns int8 / COUNT(*) as JS BigInt by default —
      // JSON.stringify on BigInt throws TypeError without a replacer.
      // The serializeBigInt path guards both budget measurement and returned data.
      mockExecute.mockResolvedValueOnce({
        rows: [{ total: 12345n }],
        rowCount: 1,
      });

      const result = await executeSqlAiTool({
        query: 'SELECT COUNT(*) AS total FROM users',
        limit: 100,
        userId: TEST_USER_ID,
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual([{ total: '12345' }]);
      expect(JSON.stringify(result)).toContain('"12345"');
      expect(result.error).toBeUndefined();
      expect(result.byteCount).toBeGreaterThan(0);
    });

    it('measures UTF-8 bytes instead of UTF-16 code units', async () => {
      mockExecute.mockResolvedValueOnce({
        rows: [{ name: '登山用バックパック' }],
        rowCount: 1,
      });

      const result = await executeSqlAiTool({
        query: 'SELECT name FROM catalog_items',
        limit: 100,
        userId: TEST_USER_ID,
      });

      expect(result.success).toBe(true);
      expect(result.byteCount).toBeGreaterThan(JSON.stringify(result.data).length);
    });
  });

  describe('existing validators (regression)', () => {
    it('rejects non-SELECT statements', async () => {
      const result = await executeSqlAiTool({
        query: 'INSERT INTO users (id) VALUES (1)',
        limit: 100,
        userId: TEST_USER_ID,
      });

      expect(result.success).toBeUndefined();
      expect(result.error).toBe('Only SELECT queries are allowed');
      expect(mockExecute).not.toHaveBeenCalled();
    });

    it('rejects queries with too many joins', async () => {
      const result = await executeSqlAiTool({
        query:
          'SELECT * FROM a JOIN b ON 1 JOIN c ON 1 JOIN d ON 1 JOIN e ON 1 JOIN f ON 1 JOIN g ON 1',
        limit: 100,
        userId: TEST_USER_ID,
      });

      expect(result.success).toBeUndefined();
      expect(result.error).toContain('maximum 5 joins');
      expect(mockExecute).not.toHaveBeenCalled();
    });

    it('appends LIMIT when not present', async () => {
      mockExecute.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const result = await executeSqlAiTool({
        query: 'SELECT id FROM users',
        limit: 50,
        userId: TEST_USER_ID,
      });

      expect(result.query).toContain('LIMIT 50');
    });
  });
});
