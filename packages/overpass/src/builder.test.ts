import { describe, expect, it } from 'vitest';
import { TrailQueryBuilder } from './builder';

describe('TrailQueryBuilder', () => {
  describe('id()', () => {
    it('builds a by-id query ignoring other filters', () => {
      const ql = new TrailQueryBuilder().id(12345).build();
      expect(ql).toBe('[out:json][timeout:25];\nrelation(12345);\nout geom;');
    });

    it('accepts bigint osmId', () => {
      const ql = new TrailQueryBuilder().id(9007199254740993n).build();
      expect(ql).toContain('relation(9007199254740993);');
    });

    it('ignores sport/name/spatial filters when id is set', () => {
      const ql = new TrailQueryBuilder().sport('hiking').around(37.7, -122.4, 50000).id(42).build();
      expect(ql).toBe('[out:json][timeout:25];\nrelation(42);\nout geom;');
    });
  });

  describe('sport()', () => {
    it('maps hiking → hiking', () => {
      const ql = new TrailQueryBuilder().sport('hiking').build();
      expect(ql).toContain('["route"="hiking"]');
    });

    it('maps cycling → bicycle', () => {
      const ql = new TrailQueryBuilder().sport('cycling').build();
      expect(ql).toContain('["route"="bicycle"]');
    });

    it('maps skiing → ski', () => {
      const ql = new TrailQueryBuilder().sport('skiing').build();
      expect(ql).toContain('["route"="ski"]');
    });

    it('maps running → running', () => {
      const ql = new TrailQueryBuilder().sport('running').build();
      expect(ql).toContain('["route"="running"]');
    });

    it('maps horse_riding → horse_riding', () => {
      const ql = new TrailQueryBuilder().sport('horse_riding').build();
      expect(ql).toContain('["route"="horse_riding"]');
    });
  });

  describe('name()', () => {
    it('adds case-insensitive name filter', () => {
      const ql = new TrailQueryBuilder().name('Pacific Crest').build();
      expect(ql).toContain('["name"~"Pacific Crest",i]');
    });

    it('escapes double quotes in name', () => {
      const ql = new TrailQueryBuilder().name('The "Big" Loop').build();
      expect(ql).toContain('["name"~"The \\"Big\\" Loop",i]');
    });
  });

  describe('around()', () => {
    it('adds around spatial filter', () => {
      const ql = new TrailQueryBuilder().around(37.7749, -122.4194, 50000).build();
      expect(ql).toContain('(around:50000,37.7749,-122.4194)');
    });

    it('rounds radius to nearest integer', () => {
      const ql = new TrailQueryBuilder().around(0, 0, 12345.6).build();
      expect(ql).toContain('(around:12346,0,0)');
    });
  });

  describe('bbox()', () => {
    it('adds bbox spatial filter', () => {
      const ql = new TrailQueryBuilder().bbox(37.5, -122.5, 37.9, -122.1).build();
      expect(ql).toContain('(37.5,-122.5,37.9,-122.1)');
    });
  });

  describe('timeout()', () => {
    it('overrides the default 25s timeout', () => {
      const ql = new TrailQueryBuilder().timeout(60).build();
      expect(ql).toMatch(/^\[out:json\]\[timeout:60\];/);
    });
  });

  describe('build() output structure', () => {
    it('always starts with preamble', () => {
      const ql = new TrailQueryBuilder().build();
      expect(ql).toMatch(/^\[out:json\]\[timeout:25\];/);
    });

    it('always includes type=route filter', () => {
      const ql = new TrailQueryBuilder().sport('hiking').build();
      expect(ql).toContain('["type"="route"]');
    });

    it('always ends with out geom', () => {
      const ql = new TrailQueryBuilder().sport('hiking').build();
      expect(ql).toMatch(/out geom;$/);
    });

    it('combines sport + name + around in correct order', () => {
      const ql = new TrailQueryBuilder()
        .sport('hiking')
        .name('JMT')
        .around(36.5, -118.5, 100000)
        .build();
      expect(ql).toContain(
        'relation["type"="route"]["route"="hiking"]["name"~"JMT",i](around:100000,36.5,-118.5)',
      );
    });

    it('works with no filters (returns all routes)', () => {
      const ql = new TrailQueryBuilder().build();
      expect(ql).toContain('relation["type"="route"]');
    });
  });
});
