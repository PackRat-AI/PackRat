import { OpenAPIHono } from '@hono/zod-openapi';
import { authMiddleware } from '@packrat/api/middleware';
import { adminRoutes } from './admin';
import { aiRoutes } from './ai';
import { authRoutes } from './auth';
import { catalogRoutes } from './catalog';
import { chatRoutes } from './chat';
import { feedRoutes } from './feed';
import { guidesRoutes } from './guides';
import { oauthMetadataHandler, oauthRoutes } from './oauth';
import { packsRoutes } from './packs';
import { packTemplatesRoutes } from './packTemplates';
import { seasonSuggestionsRoutes } from './seasonSuggestions';
import { trailConditionsRoutes } from './trailConditions';
import { tripsRoutes } from './trips';
import { uploadRoutes } from './upload';
import { userRoutes } from './user';
import { weatherRoutes } from './weather';
import { wildlifeRoutes } from './wildlife';

const publicRoutes = new OpenAPIHono();

// Mount public routes
publicRoutes.route('/auth', authRoutes);
publicRoutes.route('/admin', adminRoutes);
publicRoutes.route('/oauth', oauthRoutes);

// RFC 8414 — OAuth Authorization Server Metadata
publicRoutes.get('/.well-known/oauth-authorization-server', (c) => oauthMetadataHandler(c));

const protectedRoutes = new OpenAPIHono();

protectedRoutes.use(authMiddleware);

// Mount protected routes
protectedRoutes.route('/catalog', catalogRoutes);
protectedRoutes.route('/guides', guidesRoutes);
protectedRoutes.route('/feed', feedRoutes);
protectedRoutes.route('/packs', packsRoutes);
protectedRoutes.route('/trips', tripsRoutes);

protectedRoutes.route('/ai', aiRoutes);
protectedRoutes.route('/chat', chatRoutes);
protectedRoutes.route('/weather', weatherRoutes);
protectedRoutes.route('/pack-templates', packTemplatesRoutes);
protectedRoutes.route('/season-suggestions', seasonSuggestionsRoutes);
protectedRoutes.route('/user', userRoutes);
protectedRoutes.route('/upload', uploadRoutes);
protectedRoutes.route('/trail-conditions', trailConditionsRoutes);
protectedRoutes.route('/wildlife', wildlifeRoutes);

const routes = new OpenAPIHono();

routes.route('/', publicRoutes);
routes.route('/', protectedRoutes);

export { routes };

/** Full type of the PackRat Hono app — used by `hc<AppRoutes>()` in api-client. */
export type AppRoutes = typeof routes;
