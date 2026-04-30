import { Elysia } from 'elysia';
import { adminRoutes } from './admin';
import { aiRoutes } from './ai';
import { alltrailsRoutes } from './alltrails';
import { authRoutes } from './auth';
import { catalogRoutes } from './catalog';
import { chatRoutes } from './chat';
import { feedRoutes } from './feed';
import { guidesRoutes } from './guides';
import { knowledgeBaseRoutes } from './knowledgeBase';
import { packsRoutes } from './packs';
import { packTemplatesRoutes } from './packTemplates';
import { seasonSuggestionsRoutes } from './seasonSuggestions';
import { trailConditionsRoutes } from './trailConditions';
import { trailsRoutes } from './trails';
import { tripsRoutes } from './trips';
import { uploadRoutes } from './upload';
import { userRoutes } from './user';
import { weatherRoutes } from './weather';
import { wildlifeRoutes } from './wildlife';

/**
 * Aggregated `/api` routes – a single Elysia instance that composes every
 * route group. The exported instance carries the full type graph used by the
 * Eden Treaty client for end-to-end type safety.
 */
export const routes = new Elysia({ prefix: '/api' })
  .use(authRoutes)
  .use(adminRoutes)
  .use(catalogRoutes)
  .use(guidesRoutes)
  .use(feedRoutes)
  .use(packsRoutes)
  .use(tripsRoutes)
  .use(aiRoutes)
  .use(chatRoutes)
  .use(weatherRoutes)
  .use(packTemplatesRoutes)
  .use(seasonSuggestionsRoutes)
  .use(userRoutes)
  .use(uploadRoutes)
  .use(trailConditionsRoutes)
  .use(trailsRoutes)
  .use(wildlifeRoutes)
  .use(knowledgeBaseRoutes)
  .use(alltrailsRoutes);
