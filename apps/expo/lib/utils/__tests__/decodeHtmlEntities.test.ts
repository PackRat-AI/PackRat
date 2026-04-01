import { describe, expect, it } from 'vitest';
import { decodeHtmlEntities } from '../decodeHtmlEntities';

describe('decodeHtmlEntities', () => {
  describe('named entities', () => {
    it('should decode &amp; to &', () => {
      expect(decodeHtmlEntities('Tom &amp; Jerry')).toBe('Tom & Jerry');
    });

    it('should decode &lt; to <', () => {
      expect(decodeHtmlEntities('5 &lt; 10')).toBe('5 < 10');
    });

    it('should decode &gt; to >', () => {
      expect(decodeHtmlEntities('10 &gt; 5')).toBe('10 > 5');
    });

    it('should decode &quot; to "', () => {
      expect(decodeHtmlEntities('Say &quot;hello&quot;')).toBe('Say "hello"');
    });

    it('should decode &#39; to \'', () => {
      expect(decodeHtmlEntities('It&#39;s working')).toBe("It's working");
    });

    it('should decode &apos; to \'', () => {
      expect(decodeHtmlEntities('It&apos;s working')).toBe("It's working");
    });

    it('should decode &nbsp; to space', () => {
      expect(decodeHtmlEntities('Hello&nbsp;World')).toBe('Hello World');
    });

    it('should decode multiple entities in one string', () => {
      expect(decodeHtmlEntities('Tom &amp; Jerry: &quot;Hello&quot;')).toBe(
        'Tom & Jerry: "Hello"',
      );
    });

    it('should handle case insensitivity for named entities', () => {
      expect(decodeHtmlEntities('Tom &AMP; Jerry')).toBe('Tom & Jerry');
      expect(decodeHtmlEntities('Tom &Amp; Jerry')).toBe('Tom & Jerry');
    });
  });

  describe('decimal numeric entities', () => {
    it('should decode &#39; to apostrophe', () => {
      expect(decodeHtmlEntities('&#39;')).toBe("'");
    });

    it('should decode &#34; to double quote', () => {
      expect(decodeHtmlEntities('&#34;')).toBe('"');
    });

    it('should decode &#38; to ampersand', () => {
      expect(decodeHtmlEntities('&#38;')).toBe('&');
    });

    it('should decode &#60; to less than', () => {
      expect(decodeHtmlEntities('&#60;')).toBe('<');
    });

    it('should decode &#62; to greater than', () => {
      expect(decodeHtmlEntities('&#62;')).toBe('>');
    });

    it('should decode &#32; to space', () => {
      expect(decodeHtmlEntities('Hello&#32;World')).toBe('Hello World');
    });

    it('should decode multi-digit decimal entities', () => {
      expect(decodeHtmlEntities('&#169;')).toBe('©'); // copyright symbol
      expect(decodeHtmlEntities('&#8364;')).toBe('€'); // euro symbol
    });
  });

  describe('hexadecimal numeric entities', () => {
    it('should decode &#x27; to apostrophe', () => {
      expect(decodeHtmlEntities('&#x27;')).toBe("'");
    });

    it('should decode &#x22; to double quote', () => {
      expect(decodeHtmlEntities('&#x22;')).toBe('"');
    });

    it('should decode &#x26; to ampersand', () => {
      expect(decodeHtmlEntities('&#x26;')).toBe('&');
    });

    it('should decode &#xa9; to copyright symbol', () => {
      expect(decodeHtmlEntities('&#xa9;')).toBe('©');
    });

    it('should decode &#xA9; (uppercase) to copyright symbol', () => {
      expect(decodeHtmlEntities('&#xA9;')).toBe('©');
    });

    it('should decode multi-digit hex entities', () => {
      expect(decodeHtmlEntities('&#x20ac;')).toBe('€'); // euro symbol
    });
  });

  describe('edge cases', () => {
    it('should return empty string for empty input', () => {
      expect(decodeHtmlEntities('')).toBe('');
    });

    it('should return original string if it has no entities', () => {
      expect(decodeHtmlEntities('Hello World')).toBe('Hello World');
    });

    it('should handle strings with only entities', () => {
      expect(decodeHtmlEntities('&lt;&gt;&amp;')).toBe('<>&');
    });

    it('should handle consecutive entities', () => {
      expect(decodeHtmlEntities('&lt;&lt;&lt;')).toBe('<<<');
    });

    it('should not decode malformed entities', () => {
      expect(decodeHtmlEntities('&lt')).toBe('&lt');
      expect(decodeHtmlEntities('&')).toBe('&');
      expect(decodeHtmlEntities('&#')).toBe('&#');
      expect(decodeHtmlEntities('&#x')).toBe('&#x');
    });

    it('should not decode entities with too many characters', () => {
      expect(decodeHtmlEntities('&verylongentity;')).toBe('&verylongentity;');
    });

    it('should not decode entities with too few characters', () => {
      expect(decodeHtmlEntities('&a;')).toBe('&a;');
    });

    it('should handle mixed valid and invalid entities', () => {
      expect(decodeHtmlEntities('&amp; and &invalid;')).toBe('& and &invalid;');
    });

    it('should handle text with entities at start, middle, and end', () => {
      expect(decodeHtmlEntities('&lt;start middle&amp;end&gt;')).toBe('<start middle&end>');
    });

    it('should handle null or undefined input gracefully', () => {
      expect(decodeHtmlEntities(null as any)).toBe(null);
      expect(decodeHtmlEntities(undefined as any)).toBe(undefined);
    });
  });

  describe('real-world examples', () => {
    it('should decode HTML snippet', () => {
      const html = '&lt;div class=&quot;container&quot;&gt;Hello &amp; Welcome&lt;/div&gt;';
      const expected = '<div class="container">Hello & Welcome</div>';
      expect(decodeHtmlEntities(html)).toBe(expected);
    });

    it('should decode user input with quotes and apostrophes', () => {
      const input = 'John&#39;s book is titled &quot;The Great Adventure&quot;';
      const expected = 'John\'s book is titled "The Great Adventure"';
      expect(decodeHtmlEntities(input)).toBe(expected);
    });

    it('should decode mathematical expressions', () => {
      const expression = 'x &lt; 5 &amp; y &gt; 10';
      const expected = 'x < 5 & y > 10';
      expect(decodeHtmlEntities(expression)).toBe(expected);
    });

    it('should decode text with unicode symbols', () => {
      const text = 'Price: &#x20ac;50 &#169; 2024';
      const expected = 'Price: €50 © 2024';
      expect(decodeHtmlEntities(text)).toBe(expected);
    });
  });
});
