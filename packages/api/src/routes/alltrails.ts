import { Elysia, status } from 'elysia';
import { z } from 'zod';

const ALLTRAILS_HOSTNAME_RE = /^(?:[a-z0-9-]+\.)?alltrails\.com$/;
const UA = 'Mozilla/5.0 (compatible; PackRat/1.0; +https://packrat.world)';

function extractOgTag(html: string, property: string): string | null {
  const match =
    html.match(
      new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i'),
    ) ??
    html.match(
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, 'i'),
    );
  return match?.[1] ?? null;
}

export const alltrailsRoutes = new Elysia({ prefix: '/alltrails' }).post(
  '/preview',
  async ({ body }) => {
    const { url } = body;

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return status(400, { error: 'Invalid URL' });
    }

    if (parsed.protocol !== 'https:' || !ALLTRAILS_HOSTNAME_RE.test(parsed.hostname)) {
      return status(400, { error: 'URL must be an https://alltrails.com URL' });
    }

    let response: Response;
    try {
      response = await fetch(url, {
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(8000),
      });
    } catch (e) {
      if (e instanceof DOMException && e.name === 'TimeoutError') {
        return status(504, { error: 'Request to AllTrails timed out' });
      }
      return status(502, { error: 'Failed to fetch AllTrails URL' });
    }

    if (!response.ok) {
      return status(502, { error: `AllTrails returned status ${response.status}` });
    }

    const finalUrl = response.url || url;
    try {
      const finalHostname = new URL(finalUrl).hostname;
      if (!ALLTRAILS_HOSTNAME_RE.test(finalHostname)) {
        return status(400, { error: 'URL redirected outside alltrails.com' });
      }
    } catch {
      return status(502, { error: 'Could not parse redirect URL' });
    }

    const html = await response.text();

    const title = extractOgTag(html, 'og:title');
    if (!title) {
      return status(422, { error: 'No og:title found in AllTrails page' });
    }

    const description = extractOgTag(html, 'og:description');
    const image = extractOgTag(html, 'og:image');

    return { title, description, image, url: finalUrl };
  },
  {
    body: z.object({
      url: z.string().url(),
    }),
    detail: {
      tags: ['AllTrails'],
      summary: 'Fetch AllTrails OG preview',
      description:
        'Scrapes OpenGraph metadata (title, description, image) from an AllTrails trail page.',
    },
  },
);
