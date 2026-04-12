import { describe, expect, it } from 'vitest';
import { decodeHtmlEntities } from '../decodeHtmlEntities';

describe('decodeHtmlEntities', () => {
  // -------------------------------------------------------------------------
  // Named entities
  // -------------------------------------------------------------------------
  describe('named entities', () => {
    it('decodes ampersand entity', () => {
      expect(decodeHtmlEntities('Ben &amp; Jerry')).toBe('Ben & Jerry');
    });

    it('decodes less than entity', () => {
      expect(decodeHtmlEntities('5 &lt; 10')).toBe('5 < 10');
    });

    it('decodes greater than entity', () => {
      expect(decodeHtmlEntities('10 &gt; 5')).toBe('10 > 5');
    });

    it('decodes quote entity', () => {
      expect(decodeHtmlEntities('Say &quot;hello&quot;')).toBe('Say "hello"');
    });

    it('decodes apostrophe entities', () => {
      expect(decodeHtmlEntities('It&#39;s working')).toBe("It's working");
      expect(decodeHtmlEntities('It&apos;s also working')).toBe("It's also working");
    });

    it('decodes non-breaking space', () => {
      // &nbsp; decodes to U+00A0 (non-breaking space), not a regular space
      expect(decodeHtmlEntities('Hello&nbsp;World')).toBe('Hello\u00a0World');
    });

    it('decodes multiple entities in one string', () => {
      expect(decodeHtmlEntities('&lt;div&gt;&quot;Hello&quot;&lt;/div&gt;')).toBe(
        '<div>"Hello"</div>',
      );
    });
  });

  // -------------------------------------------------------------------------
  // Numeric entities
  // -------------------------------------------------------------------------
  describe('numeric entities', () => {
    it('decodes decimal numeric entities', () => {
      expect(decodeHtmlEntities('&#39;')).toBe("'");
      expect(decodeHtmlEntities('&#60;')).toBe('<');
      expect(decodeHtmlEntities('&#62;')).toBe('>');
      expect(decodeHtmlEntities('&#34;')).toBe('"');
      expect(decodeHtmlEntities('&#38;')).toBe('&');
    });

    it('decodes hexadecimal numeric entities', () => {
      expect(decodeHtmlEntities('&#x27;')).toBe("'");
      expect(decodeHtmlEntities('&#x3C;')).toBe('<');
      expect(decodeHtmlEntities('&#x3E;')).toBe('>');
      expect(decodeHtmlEntities('&#x22;')).toBe('"');
      expect(decodeHtmlEntities('&#x26;')).toBe('&');
    });

    it('handles uppercase hex entities', () => {
      expect(decodeHtmlEntities('&#X27;')).toBe("'");
      expect(decodeHtmlEntities('&#X3C;')).toBe('<');
    });

    it('decodes mixed numeric and named entities', () => {
      expect(decodeHtmlEntities('&#39;Hello&#39; &amp; &#x22;Goodbye&#x22;')).toBe(
        '\'Hello\' & "Goodbye"',
      );
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------
  describe('edge cases', () => {
    it('returns empty string for empty input', () => {
      expect(decodeHtmlEntities('')).toBe('');
    });

    it('returns same string when no entities present', () => {
      const text = 'Hello World';
      expect(decodeHtmlEntities(text)).toBe(text);
    });

    it('handles strings with only entities', () => {
      expect(decodeHtmlEntities('&amp;&lt;&gt;')).toBe('&<>');
    });

    it('leaves unknown entities unchanged', () => {
      expect(decodeHtmlEntities('&unknown;')).toBe('&unknown;');
      expect(decodeHtmlEntities('&toolong123456;')).toBe('&toolong123456;');
    });

    it('handles entities at string boundaries', () => {
      expect(decodeHtmlEntities('&amp;start')).toBe('&start');
      expect(decodeHtmlEntities('end&amp;')).toBe('end&');
    });

    it('handles consecutive entities', () => {
      expect(decodeHtmlEntities('&amp;&amp;&amp;')).toBe('&&&');
    });

    it('handles HTML5 legacy uppercase named entities', () => {
      // &AMP; and &GT; are valid legacy HTML5 entities (case-insensitive variants)
      expect(decodeHtmlEntities('&AMP;')).toBe('&');
      expect(decodeHtmlEntities('&GT;')).toBe('>');
      // &Lt; (capital L) is a distinct HTML5 entity meaning "much less-than" (≪), not <
      expect(decodeHtmlEntities('&Lt;')).toBe('≪');
    });
  });

  // -------------------------------------------------------------------------
  // Real-world scenarios
  // -------------------------------------------------------------------------
  describe('real-world scenarios', () => {
    it('decodes HTML snippet', () => {
      const html = '&lt;p&gt;Hello &amp; welcome&lt;/p&gt;';
      expect(decodeHtmlEntities(html)).toBe('<p>Hello & welcome</p>');
    });

    it('decodes attribute values', () => {
      const attr = 'title=&quot;Rock &amp; Roll&quot;';
      expect(decodeHtmlEntities(attr)).toBe('title="Rock & Roll"');
    });

    it('decodes mixed content', () => {
      const text = 'Price: $50 &lt; $100 &amp; &#x3E; $25';
      expect(decodeHtmlEntities(text)).toBe('Price: $50 < $100 & > $25');
    });

    it('handles text with apostrophes and quotes', () => {
      const text = 'It&#39;s a &quot;great&quot; day!';
      expect(decodeHtmlEntities(text)).toBe('It\'s a "great" day!');
    });
  });

  // -------------------------------------------------------------------------
  // Boundary and security
  // -------------------------------------------------------------------------
  describe('boundary and security', () => {
    it('decodes legacy entities without semicolon per HTML5 spec', () => {
      // The he library follows the HTML5 spec which decodes legacy entities
      // without trailing semicolons (e.g. &amp is decoded as & in HTML5 browsers)
      expect(decodeHtmlEntities('&amptest')).toBe('&test');
    });

    it('handles malformed numeric entities gracefully', () => {
      expect(decodeHtmlEntities('&#;')).toBe('&#;');
      expect(decodeHtmlEntities('&#x;')).toBe('&#x;');
    });

    it('limits entity name length to prevent performance issues', () => {
      // Entity names are limited to 2-6 characters
      expect(decodeHtmlEntities('&verylongunknownentity;')).toBe('&verylongunknownentity;');
    });
  });
});
