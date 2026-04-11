import { QueryBuilder, SQLFragments } from '@packrat/analytics/core/query-builder';
import { describe, expect, it } from 'vitest';

describe('SQLFragments', () => {
  describe('escapeSql', () => {
    it('escapes single quotes', () => {
      expect(SQLFragments.escapeSql("men's jacket")).toBe("men''s jacket");
    });

    it('returns unchanged string without quotes', () => {
      expect(SQLFragments.escapeSql('tent')).toBe('tent');
    });

    it('escapes multiple quotes', () => {
      expect(SQLFragments.escapeSql("it's a 'test'")).toBe("it''s a ''test''");
    });
  });

  describe('siteExtract', () => {
    it('generates regexp_extract SQL with default alias', () => {
      const sql = SQLFragments.siteExtract();
      expect(sql).toContain('regexp_extract(filename');
      expect(sql).toContain('as site');
    });

    it('uses custom alias', () => {
      const sql = SQLFragments.siteExtract('source');
      expect(sql).toContain('as source');
    });
  });

  describe('safeCoalesce', () => {
    it('generates COALESCE for name field with all variations', () => {
      const sql = SQLFragments.safeCoalesce('name');
      expect(sql).toContain('COALESCE(');
      expect(sql).toContain('name'); // column name from FIELD_MAPPINGS
      expect(sql).toContain("'Unknown'"); // default
      expect(sql).toContain('as name');
    });

    it('uses custom default value', () => {
      const sql = SQLFragments.safeCoalesce('brand', "'N/A'");
      expect(sql).toContain("'N/A'");
    });

    it('wraps unquoted default in quotes', () => {
      const sql = SQLFragments.safeCoalesce('brand', 'N/A');
      expect(sql).toContain("'N/A'");
    });
  });

  describe('safePrice', () => {
    it('generates CASE with fallback columns', () => {
      const sql = SQLFragments.safePrice();
      expect(sql).toContain('CASE');
      expect(sql).toContain('as price');
      expect(sql).toContain('REGEXP_REPLACE'); // fallback strip
      expect(sql).toContain('999999'); // MAX_VALID_PRICE
    });
  });

  describe('safeAvailability', () => {
    it('normalizes availability statuses', () => {
      const sql = SQLFragments.safeAvailability();
      expect(sql).toContain("'in_stock'");
      expect(sql).toContain("'out_of_stock'");
      expect(sql).toContain("'unknown'");
    });
  });

  describe('readCsvSource', () => {
    it('generates read_csv_auto with bucket path', () => {
      const sql = SQLFragments.readCsvSource('s3://my-bucket');
      expect(sql).toContain("'s3://my-bucket/v2/*/*.csv'");
      expect(sql).toContain('union_by_name=true');
      expect(sql).toContain('filename=true');
    });

    it('uses custom glob patterns', () => {
      const sql = SQLFragments.readCsvSource('s3://b', ['custom/*.csv']);
      expect(sql).toContain("'s3://b/custom/*.csv'");
      expect(sql).not.toContain('v1');
    });
  });

  describe('selectFields', () => {
    it('returns array of SQL select expressions', () => {
      const fields = SQLFragments.selectFields();
      expect(fields.length).toBeGreaterThan(10);
      // Should include core and V2 fields
      expect(fields.some((f) => f.includes('as name'))).toBe(true);
      expect(fields.some((f) => f.includes('as price'))).toBe(true);
      expect(fields.some((f) => f.includes('as site'))).toBe(true);
      expect(fields.some((f) => f.includes('as rating_value'))).toBe(true);
    });
  });

  describe('baseWhere', () => {
    it('includes name and price validations', () => {
      const conditions = SQLFragments.baseWhere();
      expect(conditions.length).toBeGreaterThanOrEqual(2);
      expect(conditions.some((c) => c.includes('name IS NOT NULL'))).toBe(true);
      expect(conditions.some((c) => c.includes('TRY_CAST(price AS DOUBLE)'))).toBe(true);
    });
  });

  describe('keywordFilter', () => {
    it('searches across name, brand, category, description', () => {
      const sql = SQLFragments.keywordFilter('tent');
      expect(sql).toContain("'%tent%'");
      expect(sql).toContain('OR');
      // Should reference field mapping variations
      expect(sql).toContain('categories'); // category variation from FIELD_MAPPINGS
    });

    it('escapes SQL injection in keyword', () => {
      const sql = SQLFragments.keywordFilter("o'reilly");
      expect(sql).toContain("o''reilly");
    });
  });

  describe('siteFilter', () => {
    it('generates IN clause for sites', () => {
      const sql = SQLFragments.siteFilter(['rei', 'backcountry']);
      expect(sql).toContain("'rei'");
      expect(sql).toContain("'backcountry'");
      expect(sql).toContain('IN');
    });

    it('returns null for empty array', () => {
      expect(SQLFragments.siteFilter([])).toBeNull();
    });

    it('escapes site names', () => {
      const sql = SQLFragments.siteFilter(["site'name"]);
      expect(sql).toContain("site''name");
    });
  });

  describe('priceRangeFilter', () => {
    it('generates min price condition', () => {
      const conditions = SQLFragments.priceRangeFilter(10);
      expect(conditions.length).toBe(1);
      expect(conditions[0]).toContain('>= 10');
    });

    it('generates max price condition', () => {
      const conditions = SQLFragments.priceRangeFilter(undefined, 100);
      expect(conditions.length).toBe(1);
      expect(conditions[0]).toContain('<= 100');
    });

    it('generates both conditions', () => {
      const conditions = SQLFragments.priceRangeFilter(10, 100);
      expect(conditions.length).toBe(2);
    });

    it('returns empty array when no range', () => {
      expect(SQLFragments.priceRangeFilter()).toEqual([]);
    });
  });
});

describe('QueryBuilder', () => {
  const qb = new QueryBuilder('s3://test-bucket');

  describe('searchQuery', () => {
    it('generates valid search SQL', () => {
      const sql = qb.searchQuery('tent');
      expect(sql).toContain('SELECT');
      expect(sql).toContain('FROM read_csv_auto');
      expect(sql).toContain('WHERE');
      expect(sql).toContain("'%tent%'");
      expect(sql).toContain('ORDER BY price ASC');
      expect(sql).toContain('LIMIT 20');
    });

    it('applies site filter', () => {
      const sql = qb.searchQuery('tent', { sites: ['rei'] });
      expect(sql).toContain("'rei'");
    });

    it('applies price range', () => {
      const sql = qb.searchQuery('tent', { minPrice: 50, maxPrice: 200 });
      expect(sql).toContain('>= 50');
      expect(sql).toContain('<= 200');
    });

    it('uses custom limit', () => {
      const sql = qb.searchQuery('tent', { limit: 50 });
      expect(sql).toContain('LIMIT 50');
    });
  });

  describe('priceComparisonQuery', () => {
    it('generates GROUP BY site query', () => {
      const sql = qb.priceComparisonQuery('tent');
      expect(sql).toContain('WITH base AS');
      expect(sql).toContain('GROUP BY site');
      expect(sql).toContain('avg_price');
      expect(sql).toContain('item_count');
    });
  });

  describe('brandAnalysisQuery', () => {
    it('filters by brand name', () => {
      const sql = qb.brandAnalysisQuery('patagonia');
      expect(sql).toContain("'%patagonia%'");
      expect(sql).toContain('GROUP BY site, category');
    });

    it('escapes brand name', () => {
      const sql = qb.brandAnalysisQuery("Arc'teryx");
      expect(sql).toContain("arc''teryx");
    });
  });

  describe('categoryInsightsQuery', () => {
    it('filters by category and groups by site', () => {
      const sql = qb.categoryInsightsQuery('jackets');
      expect(sql).toContain("'%jackets%'");
      expect(sql).toContain('brand_count');
      expect(sql).toContain('GROUP BY site');
    });
  });

  describe('dealsQuery', () => {
    it('filters by max price', () => {
      const sql = qb.dealsQuery(50);
      expect(sql).toContain('<= 50');
      expect(sql).toContain('ORDER BY price ASC');
    });

    it('filters by category', () => {
      const sql = qb.dealsQuery(100, { category: 'tents' });
      expect(sql).toContain("'%tents%'");
    });
  });

  describe('trendsQuery', () => {
    it('generates time-series aggregation', () => {
      const sql = qb.trendsQuery('tent');
      expect(sql).toContain('scrape_date');
      expect(sql).toContain('avg_price');
      expect(sql).toContain('observations');
      expect(sql).toContain("INTERVAL '90 days'");
    });

    it('uses custom days parameter', () => {
      const sql = qb.trendsQuery('tent', undefined, 30);
      expect(sql).toContain("INTERVAL '30 days'");
    });
  });

  describe('normalizedSelectQuery', () => {
    it('generates select without CREATE TABLE', () => {
      const sql = qb.normalizedSelectQuery();
      expect(sql).toContain('SELECT');
      expect(sql).not.toContain('CREATE TABLE');
    });
  });

  describe('createCacheTable', () => {
    it('wraps normalized query in CREATE TABLE', () => {
      const sql = qb.createCacheTable();
      expect(sql).toContain('CREATE TABLE gear_data AS');
    });

    it('uses custom table name', () => {
      const sql = qb.createCacheTable('my_cache');
      expect(sql).toContain('CREATE TABLE my_cache AS');
    });
  });

  describe('createPriceHistoryTable', () => {
    it('generates price history table', () => {
      const sql = qb.createPriceHistoryTable();
      expect(sql).toContain('CREATE TABLE price_history AS');
      expect(sql).toContain('scrape_date');
      expect(sql).toContain('price');
    });
  });
});
