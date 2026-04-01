import { describe, expect, it, vi } from 'vitest';
import { api, expectJsonResponse } from './utils/test-helpers';

// Mock fetch to simulate fetching content from URLs
global.fetch = vi.fn();

describe('Knowledge Base Routes', () => {
  describe('POST /api/knowledge-base/reader/extract', () => {
    it('should extract content from a valid URL', async () => {
      // Mock HTML content from a typical article
      const mockHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Test Article Title</title>
            <meta name="author" content="John Doe" />
          </head>
          <body>
            <article>
              <h1>Test Article Title</h1>
              <p class="byline">By John Doe</p>
              <p>This is the main content of the article. It contains important information about hiking and camping.</p>
              <p>More content here with useful details.</p>
            </article>
          </body>
        </html>
      `;

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => mockHtml,
      });

      const response = await api('/knowledge-base/reader/extract', {
        method: 'POST',
        body: JSON.stringify({
          url: 'https://example.com/article',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      expectJsonResponse(response, 200);
      const result = await response.json();

      expect(result).toMatchObject({
        title: expect.any(String),
        content: expect.any(String),
        textContent: expect.any(String),
        cleanedText: expect.any(String),
        length: expect.any(Number),
      });

      // Verify content contains expected text
      expect(result.textContent).toContain('main content of the article');
    });

    it('should handle articles with various HTML elements', async () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html>
          <body>
            <article>
              <h1>Main Heading</h1>
              <h2>Subheading</h2>
              <p><strong>Bold text</strong> and <em>italic text</em></p>
              <ul>
                <li>List item 1</li>
                <li>List item 2</li>
              </ul>
              <a href="https://example.com">Link text</a>
            </article>
          </body>
        </html>
      `;

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => mockHtml,
      });

      const response = await api('/knowledge-base/reader/extract', {
        method: 'POST',
        body: JSON.stringify({
          url: 'https://example.com/complex-article',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      expectJsonResponse(response, 200);
      const result = await response.json();

      expect(result.textContent).toContain('Main Heading');
      expect(result.textContent).toContain('Bold text');
      expect(result.textContent).toContain('List item');
    });

    it('should convert HTML to markdown', async () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html>
          <body>
            <article>
              <h1>Title</h1>
              <h2>Section</h2>
              <p><strong>Bold</strong> and <em>italic</em></p>
              <ul>
                <li>Item 1</li>
                <li>Item 2</li>
              </ul>
            </article>
          </body>
        </html>
      `;

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => mockHtml,
      });

      const response = await api('/knowledge-base/reader/extract', {
        method: 'POST',
        body: JSON.stringify({
          url: 'https://example.com/markdown-test',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      expectJsonResponse(response, 200);
      const result = await response.json();

      expect(result.markdown).toBeDefined();
      expect(result.markdown).toContain('#'); // Heading marker
      expect(result.markdown).toContain('**'); // Bold marker
      expect(result.markdown).toContain('*'); // Italic marker
      expect(result.markdown).toContain('-'); // List marker
    });

    it('should clean text by removing extra whitespace', async () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html>
          <body>
            <article>
              <p>Text   with    multiple     spaces</p>
              <p>


                Text with multiple newlines


              </p>
              <p>Text	with	tabs</p>
            </article>
          </body>
        </html>
      `;

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => mockHtml,
      });

      const response = await api('/knowledge-base/reader/extract', {
        method: 'POST',
        body: JSON.stringify({
          url: 'https://example.com/whitespace-test',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      expectJsonResponse(response, 200);
      const result = await response.json();

      // cleanedText should have normalized whitespace
      expect(result.cleanedText).not.toContain('  '); // No double spaces
      expect(result.cleanedText).not.toMatch(/\n\n\n/); // No triple newlines
    });

    it('should return 400 for invalid URL (fetch fails)', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const response = await api('/knowledge-base/reader/extract', {
        method: 'POST',
        body: JSON.stringify({
          url: 'https://example.com/nonexistent',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(response.status).toBe(400);
      const error = await response.json();
      expect(error.error).toContain('Failed to fetch URL');
    });

    it('should return 400 for content that cannot be extracted', async () => {
      // Mock HTML that Readability cannot parse (e.g., no article content)
      const mockHtml = `
        <!DOCTYPE html>
        <html>
          <body>
            <div>Just some random text with no article structure</div>
          </body>
        </html>
      `;

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => mockHtml,
      });

      const response = await api('/knowledge-base/reader/extract', {
        method: 'POST',
        body: JSON.stringify({
          url: 'https://example.com/no-content',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(response.status).toBe(400);
      const error = await response.json();
      expect(error.error).toContain('Failed to extract content');
    });

    it('should handle articles with metadata', async () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta property="og:site_name" content="Example Site" />
          </head>
          <body>
            <article>
              <h1>Article with Metadata</h1>
              <p class="byline">By Jane Smith</p>
              <p>Article content here.</p>
            </article>
          </body>
        </html>
      `;

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => mockHtml,
      });

      const response = await api('/knowledge-base/reader/extract', {
        method: 'POST',
        body: JSON.stringify({
          url: 'https://example.com/metadata-article',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      expectJsonResponse(response, 200);
      const result = await response.json();

      expect(result.title).toBeDefined();
      expect(result.byline).toBeDefined();
      // siteName may or may not be extracted depending on Readability's parsing
    });

    it('should return content length', async () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html>
          <body>
            <article>
              <h1>Length Test</h1>
              <p>This is a test article with some content to verify that the length property is correctly calculated.</p>
            </article>
          </body>
        </html>
      `;

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => mockHtml,
      });

      const response = await api('/knowledge-base/reader/extract', {
        method: 'POST',
        body: JSON.stringify({
          url: 'https://example.com/length-test',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      expectJsonResponse(response, 200);
      const result = await response.json();

      expect(result.length).toBeGreaterThan(0);
      expect(typeof result.length).toBe('number');
    });

    it('should handle network errors gracefully', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Network error'),
      );

      const response = await api('/knowledge-base/reader/extract', {
        method: 'POST',
        body: JSON.stringify({
          url: 'https://example.com/network-error',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(response.status).toBe(500);
      const error = await response.json();
      expect(error.error).toContain('Failed to process the URL');
    });

    it('should handle malformed HTML', async () => {
      const mockHtml = `
        <html><body><article>
        <h1>Malformed HTML
        <p>Missing closing tags
        Content here
      `;

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => mockHtml,
      });

      const response = await api('/knowledge-base/reader/extract', {
        method: 'POST',
        body: JSON.stringify({
          url: 'https://example.com/malformed',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      // Should still extract what it can
      expectJsonResponse(response, 200);
      const result = await response.json();
      expect(result.textContent).toContain('Malformed HTML');
    });
  });
});
