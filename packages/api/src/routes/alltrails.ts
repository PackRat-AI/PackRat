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
      return status(400, { error: 'URL must be an https://alltrails.com (or subdomain) URL' });
    }

    let response: Response;
    try {
      response = await fetch(url, {
        headers: { 'User-Agent': UA },
        redirect: 'manual',
        signal: AbortSignal.timeout(8000),
      });
    } catch (e) {
      if (e instanceof DOMException && e.name === 'TimeoutError') {
        return status(504, { error: 'Request to AllTrails timed out' });
      }
      return status(502, { error: 'Failed to fetch AllTrails URL' });
    }

    // Validate any redirect before following it (SSRF guard)
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) {
        return status(502, { error: 'AllTrails redirected without a Location header' });
      }
      let redirectUrl: URL;
      try {
        redirectUrl = new URL(location, url);
      } catch {
        return status(502, { error: 'Invalid redirect URL from AllTrails' });
      }
      if (redirectUrl.protocol !== 'https:' || !ALLTRAILS_HOSTNAME_RE.test(redirectUrl.hostname)) {
        return status(400, { error: 'URL redirected outside alltrails.com' });
      }
      try {
        response = await fetch(redirectUrl.toString(), {
          headers: { 'User-Agent': UA },
          redirect: 'error',
          signal: AbortSignal.timeout(8000),
        });
      } catch (e) {
        if (e instanceof DOMException && e.name === 'TimeoutError') {
          return status(504, { error: 'Request to AllTrails timed out' });
        }
        return status(502, { error: 'Failed to fetch AllTrails URL' });
      }
    }

    if (!response.ok) {
      return status(502, { error: `AllTrails returned status ${response.status}` });
    }

    const html = await response.text();

    const title = extractOgTag(html, 'og:title');
    if (!title) {
      return status(422, { error: 'No og:title found in AllTrails page' });
    }

    const description = extractOgTag(html, 'og:description');
    const image = extractOgTag(html, 'og:image');

    return { title, description, image, url: response.url || url };
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
