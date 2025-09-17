import { OpenAPIHono } from '@hono/zod-openapi';
import { authMiddleware } from '@packrat/api/middleware';
import { adminRoutes } from './admin';
import { authRoutes } from './auth';
import { catalogRoutes } from './catalog';
import { chatRoutes } from './chat';
import { guidesRoutes } from './guides';
import { packsRoutes } from './packs';
import { packTemplatesRoutes } from './packTemplates';
import { uploadRoutes } from './upload';
import { userRoutes } from './user';
import { weatherRoutes } from './weather';

const publicRoutes = new OpenAPIHono();

// Mount public routes
publicRoutes.route('/auth', authRoutes);
publicRoutes.route('/admin', adminRoutes);

const protectedRoutes = new OpenAPIHono();

protectedRoutes.use(authMiddleware);

// Mount protected routes
protectedRoutes.route('/catalog', catalogRoutes);
protectedRoutes.route('/guides', guidesRoutes);
protectedRoutes.route('/packs', packsRoutes);
protectedRoutes.route('/chat', chatRoutes);
protectedRoutes.route('/weather', weatherRoutes);
protectedRoutes.route('/pack-templates', packTemplatesRoutes);
protectedRoutes.route('/user', userRoutes);
protectedRoutes.route('/upload', uploadRoutes);

const routes = new OpenAPIHono();

routes.route('/', publicRoutes);
routes.route('/', protectedRoutes);

export { routes };
