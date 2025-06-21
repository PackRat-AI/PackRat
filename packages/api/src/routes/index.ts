import { authMiddleware } from "@/middleware";
import { OpenAPIHono } from "@hono/zod-openapi";
import { authRoutes } from "./auth";
import { catalogRoutes } from "./catalog";
import { chatRoutes } from './chat';
import { packsRoutes } from "./packs";
import { weatherRoutes } from './weather';
import { uploadRoutes } from './upload';
import { userRoutes } from "./user";

const publicRoutes = new OpenAPIHono();

// Mount public routes
publicRoutes.route("/auth", authRoutes);

const protectedRoutes = new OpenAPIHono();

protectedRoutes.use(authMiddleware);

// Mount protected routes
protectedRoutes.route("/catalog", catalogRoutes);
protectedRoutes.route("/packs", packsRoutes);
protectedRoutes.route('/chat', chatRoutes);
publicRoutes.route('/weather', weatherRoutes);
protectedRoutes.route("/user", userRoutes);
protectedRoutes.route("/upload", uploadRoutes);

const routes = new OpenAPIHono();

routes.route("/", publicRoutes);
routes.route("/", protectedRoutes);

export { routes };
