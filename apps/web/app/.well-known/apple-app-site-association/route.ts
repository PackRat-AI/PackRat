import { IOS_APP_ID } from 'web-app/lib/share-links';

/**
 * Universal links: lets iOS open `packrat.world/p/*` share links straight in
 * the app when it is installed. Apple fetches this file without an extension
 * and requires `application/json`, so it is served from a route handler rather
 * than `public/`.
 */
export const dynamic = 'force-static';

export function GET() {
  return Response.json({
    applinks: {
      details: [{ appIDs: [IOS_APP_ID], components: [{ '/': '/p/*' }] }],
    },
  });
}
