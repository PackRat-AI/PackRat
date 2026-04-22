import { $, OpenAPIHono } from '@hono/zod-openapi';
import { authMiddleware } from '@packrat/api/middleware';
import { adminRoutes } from './admin';
import { aiRoutes } from './ai';
import { authRoutes } from './auth';
import { catalogRoutes } from './catalog';
import { chatRoutes } from './chat';
import { feedRoutes } from './feed';
import { guidesRoutes } from './guides';
import { packsRoutes } from './packs';
import { packTemplatesRoutes } from './packTemplates';
import { seasonSuggestionsRoutes } from './seasonSuggestions';
import { trailConditionsRoutes } from './trailConditions';
import { tripsRoutes } from './trips';
import { uploadRoutes } from './upload';
import { userRoutes } from './user';
import { weatherRoutes } from './weather';
import { wildlifeRoutes } from './wildlife';

const publicRoutes = $(new OpenAPIHono().route('/auth', authRoutes).route('/admin', adminRoutes));

const protectedRoutes = $(
  new OpenAPIHono()
    .use(authMiddleware)
    .route('/catalog', catalogRoutes)
    .route('/guides', guidesRoutes)
    .route('/feed', feedRoutes)
    .route('/packs', packsRoutes)
    .route('/trips', tripsRoutes)
    .route('/ai', aiRoutes)
    .route('/chat', chatRoutes)
    .route('/weather', weatherRoutes)
    .route('/pack-templates', packTemplatesRoutes)
    .route('/season-suggestions', seasonSuggestionsRoutes)
    .route('/user', userRoutes)
    .route('/upload', uploadRoutes)
    .route('/trail-conditions', trailConditionsRoutes)
    .route('/wildlife', wildlifeRoutes),
);

const routes = $(new OpenAPIHono().route('/', publicRoutes).route('/', protectedRoutes));

export { routes };
