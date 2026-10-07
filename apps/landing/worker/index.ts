/**
 * Worker in front of the landing site's static assets. It runs only for
 * `/p/*` (`assets.run_worker_first` in `wrangler.jsonc`); every other path is
 * served straight from `out/`.
 *
 * Shared-post links (`/p/{publicId}`) need per-post Open Graph tags in the
 * server response — link previews never run JavaScript — and a static export
 * cannot produce them. So the Worker fetches the post, takes the exported `/p`
 * shell, and rewrites its `<head>` with the post's title, caption and cover
 * photo. The post itself is embedded as JSON for the page to render, so the
 * browser makes no API call of its own.
 */
import {
  parsePublicId,
  renderMetaTags,
  renderPayloadScript,
  type SharedPost,
  type SharedPostPayload,
  sharedPostMetaTags,
  sharedPostTitle,
  sharedPostUrl,
} from '../lib/shared-post';

// Minimal shapes of the Workers runtime APIs used here. The landing app's
// TypeScript program is a DOM/Next one, so `@cloudflare/workers-types` is not
// loaded globally.
type AssetsFetcher = { fetch: (request: Request) => Promise<Response> };
type RewriterElement = {
  remove: () => void;
  setInnerContent: (content: string) => void;
  append: (content: string, options: { html: boolean }) => void;
};
type Rewriter = {
  on: (selector: string, handlers: { element: (el: RewriterElement) => void }) => Rewriter;
  transform: (response: Response) => Response;
};
declare const HTMLRewriter: { new (): Rewriter };

export type Env = {
  ASSETS: AssetsFetcher;
  /** API origin, e.g. `https://packrat-api.orange-frost-d665.workers.dev`. */
  PACKRAT_API_URL: string;
};

/** Head tags the static shell inherits from the site layout and the Worker replaces per post. */
const REPLACED_HEAD_TAGS = [
  'meta[name="description"]',
  'meta[property^="og:"]',
  'meta[name^="twitter:"]',
  'link[rel="canonical"]',
];

async function fetchPost({
  env,
  publicId,
}: {
  env: Env;
  publicId: string;
}): Promise<SharedPostPayload> {
  try {
    const response = await fetch(`${env.PACKRAT_API_URL}/api/feed/public/${publicId}`, {
      headers: { Accept: 'application/json' },
    });
    if (response.status === 404) return { status: 'not-found' };
    if (!response.ok) {
      console.error(`shared post ${publicId}: API responded ${response.status}`);
      return { status: 'error' };
    }
    return { status: 'ok', post: (await response.json()) as SharedPost };
  } catch (error) {
    console.error(`shared post ${publicId}: API request failed`, error);
    return { status: 'error' };
  }
}

function statusFor(payload: SharedPostPayload): number {
  if (payload.status === 'not-found') return 404;
  if (payload.status === 'error') return 503;
  return 200;
}

export function rewriteShell(shell: Response, payload: SharedPostPayload): Response {
  let rewriter = new HTMLRewriter();
  if (payload.status === 'ok') {
    const { post } = payload;
    for (const selector of REPLACED_HEAD_TAGS) {
      rewriter = rewriter.on(selector, { element: (el) => el.remove() });
    }
    rewriter = rewriter
      .on('title', { element: (el) => el.setInnerContent(sharedPostTitle(post)) })
      .on('head', {
        element: (el) =>
          el.append(
            `${renderMetaTags(sharedPostMetaTags(post))}<link rel="canonical" href="${sharedPostUrl(post.publicId)}">`,
            { html: true },
          ),
      });
  } else {
    rewriter = rewriter.on('title', {
      element: (el) => el.setInnerContent('Post not available | PackRat'),
    });
  }
  rewriter = rewriter.on('body', {
    element: (el) => el.append(renderPayloadScript(payload), { html: true }),
  });

  const headers = new Headers(shell.headers);
  // The body no longer matches the asset's validators, and a removed post must
  // stop previewing promptly.
  headers.delete('ETag');
  headers.set('Cache-Control', 'public, max-age=60');
  return new Response(rewriter.transform(shell).body, { status: statusFor(payload), headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/p/')) return env.ASSETS.fetch(request);

    const shell = await env.ASSETS.fetch(new Request(new URL('/p', url), request));
    if (!shell.ok) return shell;

    const publicId = parsePublicId(url.pathname);
    const payload: SharedPostPayload = publicId
      ? await fetchPost({ env, publicId })
      : { status: 'not-found' };
    return rewriteShell(shell, payload);
  },
};
