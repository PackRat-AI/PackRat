import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { Readability } from '@mozilla/readability';
import type { Env } from '@packrat/api/utils/env-validation';
import { parseHTML } from 'linkedom';

const readerRoutes = new OpenAPIHono<{ Bindings: Env }>();

const extractContentRoute = createRoute({
  method: 'post',
  path: '/extract',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            url: z.string().url(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Extracted content from URL',
      content: {
        'application/json': {
          schema: z.object({
            title: z.string().nullable(),
            byline: z.string().nullable(),
            content: z.string(),
            textContent: z.string(),
            length: z.number(),
            excerpt: z.string().nullable(),
            siteName: z.string().nullable(),
            cleanedText: z.string(),
            markdown: z.string().nullable(),
          }),
        },
      },
    },
    400: {
      description: 'Bad Request',
    },
    401: {
      description: 'Unauthorized',
    },
    500: {
      description: 'Internal Server Error',
    },
  },
});

// Utility to clean up text for embeddings
function cleanTextForEmbedding(text: string): string {
  return text
    .replace(/\s{2,}/g, ' ') // Collapse multiple spaces
    .replace(/\n{2,}/g, '\n') // Collapse multiple newlines
    .replace(/\t/g, ' ') // Replace tabs with space
    .replace(/\u00a0/g, ' ') // Replace non-breaking spaces
    .replace(/^\s+|\s+$/g, '') // Trim
    .replace(/(We appreciate the time and effort.*|Steve)$/gim, '') // Remove boilerplate signature
    .trim();
}

// Pure TypeScript/regex HTML to Markdown converter (safe for edge)
function htmlToMarkdown(html: string): string {
  return html
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
    .replace(/<[^>]+>/g, '') // Remove all other tags
    .replace(/\n{3,}/g, '\n\n') // Collapse 3+ newlines
    .replace(/^[ \t]+/gm, '') // Remove leading spaces
    .trim();
}

readerRoutes.openapi(extractContentRoute, async (c) => {
  try {
    console.log('[extract] Request received');
    const { url } = await c.req.json();
    console.log(`[extract] URL to fetch: ${url}`);

    // Fetch the content from the URL
    console.log('[extract] Starting fetch...');
    const response = await fetch(url);
    if (!response.ok) {
      console.log(`[extract] Fetch failed: ${response.status} ${response.statusText}`);
      return c.json({ error: `Failed to fetch URL: ${response.statusText}` }, 400);
    }

    console.log('[extract] Fetch completed');
    const html = await response.text();
    console.log(`[extract] HTML length: ${html.length}`);

    // Parse the HTML with LinkeDOM
    console.log('[extract] Parsing HTML with LinkeDOM...');
    const { window } = parseHTML(html);
    console.log('[extract] DOM parse completed');
    console.log('[extract] Running Readability...');
    const reader = new Readability(window.document);
    const article = reader.parse();
    console.log('[extract] Readability completed');

    if (!article) {
      console.log('[extract] Readability failed to extract article');
      return c.json({ error: 'Failed to extract content from the URL' }, 400);
    }

    // Clean up the text content
    const cleanedText = cleanTextForEmbedding(article.textContent || '');

    // Convert HTML to Markdown using our pure function
    let markdown = null;
    try {
      markdown = htmlToMarkdown(article.content || '');
    } catch (err) {
      console.warn('[extract] Markdown conversion failed', err);
    }

    console.log('[extract] Extraction successful, returning response');
    return c.json({
      title: article.title,
      byline: article.byline,
      content: article.content,
      textContent: article.textContent,
      length: article.length,
      excerpt: article.excerpt,
      siteName: article.siteName,
      cleanedText,
      markdown,
    });
  } catch (error) {
    console.error('[extract] Error extracting content:', error);
    return c.json({ error: 'Failed to process the URL' }, 500);
  }
});

export { readerRoutes };
