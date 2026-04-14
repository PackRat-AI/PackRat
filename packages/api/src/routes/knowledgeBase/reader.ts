import { Readability } from '@mozilla/readability';
import { Elysia, status } from 'elysia';
import { parseHTML } from 'linkedom';
import { z } from 'zod';

// Utility to clean up text for embeddings
function cleanTextForEmbedding(text: string): string {
  return text
    .replace(/\s{2,}/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/^\s+|\s+$/g, '')
    .replace(/(We appreciate the time and effort.*|Steve)$/gim, '')
    .trim();
}

function htmlToMarkdown(html: string): string {
  let result = html
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '# $1\n')
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '## $1\n')
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '### $1\n')
    .replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '#### $1\n')
    .replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, '##### $1\n')
    .replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, '###### $1\n')
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n')
    .replace(/<ul[^>]*>|<\/ul>/gi, '')
    .replace(/<ol[^>]*>|<\/ol>/gi, '')
    .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**')
    .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*')
    .replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*')
    .replace(/<a [^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
    .replace(/<img [^>]*alt=["']([^"']*)["'][^>]*>/gi, '![$1]()')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<p[^>]*>/gi, '')
    .replace(/<\/p>/gi, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^[ \t]+/gm, '')
    .trim();

  // Strip any remaining HTML tags in multiple passes to avoid incomplete
  // multi-character sanitization (e.g. crafted inputs like <<script>>).
  let prev = '';
  let iterations = 0;
  while (result !== prev && iterations++ < 10) {
    prev = result;
    result = result.replace(/<[^>]*>/g, '');
  }
  return result;
}

export const readerRoutes = new Elysia({ prefix: '/reader' }).post(
  '/extract',
  async ({ body }) => {
    try {
      const { url } = body;

      const response = await fetch(url);
      if (!response.ok) {
        return status(400, { error: `Failed to fetch URL: ${response.statusText}` });
      }

      const html = await response.text();

      const { window } = parseHTML(html);
      const reader = new Readability(window.document);
      const article = reader.parse();

      if (!article) {
        return status(400, { error: 'Failed to extract content from the URL' });
      }

      const cleanedText = cleanTextForEmbedding(article.textContent || '');

      let markdown: string | null = null;
      try {
        markdown = htmlToMarkdown(article.content || '');
      } catch (err) {
        console.warn('[extract] Markdown conversion failed', err);
      }

      return {
        title: article.title,
        byline: article.byline,
        content: article.content,
        textContent: article.textContent,
        length: article.length,
        excerpt: article.excerpt,
        siteName: article.siteName,
        cleanedText,
        markdown,
      };
    } catch (error) {
      console.error('[extract] Error extracting content:', error);
      return status(500, { error: 'Failed to process the URL' });
    }
  },
  {
    body: z.object({ url: z.string().url() }),
    detail: {
      tags: ['Knowledge Base'],
      summary: 'Extract content from a URL',
    },
  },
);
