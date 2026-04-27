import { Readability } from '@mozilla/readability';
import { Elysia, status } from 'elysia';
import { parseHTML } from 'linkedom';
import { z } from 'zod';

// \u2500\u2500 HTML \u2192 Markdown conversion patterns \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
const WHITESPACE_RUNS = /\s{2,}/g;
const NEWLINE_RUNS = /\n{2,}/g;
const TAB_CHAR = /\t/g;
const NON_BREAKING_SPACE = /\u00a0/g;
const LEADING_TRAILING_WHITESPACE = /^\s+|\s+$/g;
const BOILERPLATE_FOOTER = /(We appreciate the time and effort.*|Steve)$/gim;
const HTML_H1 = /<h1[^>]*>([\s\S]*?)<\/h1>/gi;
const HTML_H2 = /<h2[^>]*>([\s\S]*?)<\/h2>/gi;
const HTML_H3 = /<h3[^>]*>([\s\S]*?)<\/h3>/gi;
const HTML_H4 = /<h4[^>]*>([\s\S]*?)<\/h4>/gi;
const HTML_H5 = /<h5[^>]*>([\s\S]*?)<\/h5>/gi;
const HTML_H6 = /<h6[^>]*>([\s\S]*?)<\/h6>/gi;
const HTML_LI = /<li[^>]*>([\s\S]*?)<\/li>/gi;
const HTML_UL = /<ul[^>]*>|<\/ul>/gi;
const HTML_OL = /<ol[^>]*>|<\/ol>/gi;
const HTML_STRONG = /<strong[^>]*>([\s\S]*?)<\/strong>/gi;
const HTML_B = /<b[^>]*>([\s\S]*?)<\/b>/gi;
const HTML_EM = /<em[^>]*>([\s\S]*?)<\/em>/gi;
const HTML_I = /<i[^>]*>([\s\S]*?)<\/i>/gi;
const HTML_A = /<a [^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
const HTML_IMG = /<img [^>]*alt=["']([^"']*)["'][^>]*>/gi;
const HTML_BR = /<br\s*\/?>/gi;
const HTML_P_OPEN = /<p[^>]*>/gi;
const HTML_P_CLOSE = /<\/p>/gi;
const TRIPLE_PLUS_NEWLINES = /\n{3,}/g;
const LINE_LEADING_WHITESPACE = /^[ \t]+/gm;
const HTML_TAGS = /<[^>]*>/g;

// Utility to clean up text for embeddings
function cleanTextForEmbedding(text: string): string {
  return text
    .replace(WHITESPACE_RUNS, ' ')
    .replace(NEWLINE_RUNS, '\n')
    .replace(TAB_CHAR, ' ')
    .replace(NON_BREAKING_SPACE, ' ')
    .replace(LEADING_TRAILING_WHITESPACE, '')
    .replace(BOILERPLATE_FOOTER, '')
    .trim();
}

function htmlToMarkdown(html: string): string {
  let result = html
    .replace(HTML_H1, '# $1\n')
    .replace(HTML_H2, '## $1\n')
    .replace(HTML_H3, '### $1\n')
    .replace(HTML_H4, '#### $1\n')
    .replace(HTML_H5, '##### $1\n')
    .replace(HTML_H6, '###### $1\n')
    .replace(HTML_LI, '- $1\n')
    .replace(HTML_UL, '')
    .replace(HTML_OL, '')
    .replace(HTML_STRONG, '**$1**')
    .replace(HTML_B, '**$1**')
    .replace(HTML_EM, '*$1*')
    .replace(HTML_I, '*$1*')
    .replace(HTML_A, '[$2]($1)')
    .replace(HTML_IMG, '![$1]()')
    .replace(HTML_BR, '\n')
    .replace(HTML_P_OPEN, '')
    .replace(HTML_P_CLOSE, '\n')
    .replace(TRIPLE_PLUS_NEWLINES, '\n\n')
    .replace(LINE_LEADING_WHITESPACE, '')
    .trim();

  // Strip any remaining HTML tags in multiple passes to avoid incomplete
  // multi-character sanitization (e.g. crafted inputs like <<script>>).
  let prev = '';
  let iterations = 0;
  while (result !== prev && iterations++ < 10) {
    prev = result;
    result = result.replace(HTML_TAGS, '');
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
    isAuthenticated: true,
    detail: {
      tags: ['Knowledge Base'],
      summary: 'Extract content from a URL',
    },
  },
);
