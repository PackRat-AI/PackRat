import express, { Request, Response } from 'express';
import path from 'path';
// import csrf from 'csurf';
import { csrf } from 'hono/csrf';
import packRoutes from './packRoutes';
import itemRoutes from './itemRoutes';
import tripRoutes from './tripRoutes';
import weatherRoutes from './weatherRoutes';
import geoCodeRoutes from './geoCodeRoutes';
import getParkRoutes from './getParkRoutes';
import getTrailRoutes from './getTrailRoutes';
import osmRoutes from './osmRoutes';
import passwordResetRoutes from './passwordResetRoutes';
import openAiRoutes from './openAiRoutes';
import templateRoutes from './templateRoutes';
import favoriteRoutes from './favoriteRoutes';
import userRoutes from './userRoutes';
import mapPreviewRouter from './mapPreviewRouter';
import { Hono } from 'hono';
import type { Context, Next } from 'hono';
import { zodParser } from '../middleware/validators/zodParser';
import * as validator from '@packrat/validations';

const router = new Hono();

// Create a CSRF middleware
// const csrfProtection = csrf({ cookie: true });
const csrfProtection = csrf();

/**
 * Logs the incoming request method and path, and logs the finished request method, path, status code, and request body.
 *
 * @param {Context} c - The Hono context object.
 * @param {Function} next - The next function to call in the middleware chain.
 */
const logger = async (c: Context, next: Next) => {
  console.log(`Incoming ${c.req.method} ${c.req.url}`);
  await next();
  console.log(`Finished ${c.req.method} ${c.req.url} ${c.res.status}`);
  console.log(`Body ${await c.req.text()}`);
};

// Use logger middleware in development
if (process.env.NODE_ENV !== 'production') {
  router.use('*', logger);
}

// Use CSRF middleware
router.use(csrfProtection);

// Use routes
router.route('/user', userRoutes);
router.use('/pack', packRoutes);
router.use('/item', itemRoutes);
router.use('/trip', tripRoutes);
router.use('/weather', weatherRoutes);
router.use('/geocode', geoCodeRoutes);
router.use('/getparks', getParkRoutes);
router.use('/gettrails', getTrailRoutes);
router.use('/osm', osmRoutes);
router.use('/password-reset', passwordResetRoutes);
router.use('/openai', openAiRoutes);
router.use('/template', templateRoutes);
router.use('/favorite', favoriteRoutes);
router.use('/openai', openAiRoutes);
router.route('/mapPreview', mapPreviewRouter);

// Create a separate router for '/hello' route
const helloRouter = new Hono();
helloRouter.get('/', async (c: Context) => {
  console.log(c);
  return c.text('Hello, world!');
});

helloRouter.get(
  'GetFello/:userId',
  ((c: Context, next: Next) => {
    console.log('context is loading', c.req.param());
    zodParser(validator.getUserById, c.req.param(), next);
    next();
  }) as any,
  async (c: Context, next: Next) => {
    // console.log(c.req);
    return c.text('Hello, Forld!');
  },
);
router.route('/hello', helloRouter);

// Also listen to /api for backwards compatibility
router.use('/api/user', userRoutes);
router.use('/api/pack', packRoutes);
router.use('/api/item', itemRoutes);
router.use('/api/trip', tripRoutes);
router.use('/api/weather', weatherRoutes);
router.use('/api/geocode', geoCodeRoutes);
router.use('/api/getparks', getParkRoutes);
router.use('/api/gettrails', getTrailRoutes);
router.use('/api/osm', osmRoutes);
router.use('/api/password-reset', passwordResetRoutes);
router.use('/api/openai', openAiRoutes);
router.use('/api/template', templateRoutes);
router.use('/api/favorite', favoriteRoutes);
router.use('/api/openai', openAiRoutes);
router.use('/api/mapPreview', mapPreviewRouter);

// // Static routes for serving the React Native Web app
// if (process.env.NODE_ENV === 'production') {
//   const __dirname = path.resolve();
//   const serverType = process.env.REACT_APP_SERVER_TYPE || 'vite';

//   // Serve the client's index.html file at the root route
//   router.get('/', async (c: Context) => {
//     const basePath =
//       serverType === 'next' ? '../apps/next/out' : '../apps/vite/dist';
//     return c.html(path.resolve(__dirname, basePath, 'index.html'));
//   });

//   // Serve the static assets
//   const staticPath =
//     serverType === 'next' ? '../apps/next/out' : '../apps/vite/dist';
//   router.use('*', express.static(path.join(__dirname, staticPath)));

//   // Serve the client's index.html file at all other routes NOT starting with /api
//   router.get(/^(?!\/?api).*/, async (c: Context) => {
//     const basePath =
//       serverType === 'next' ? '../apps/next/out' : '../apps/vite/dist';
//     return c.html(path.resolve(__dirname, basePath, 'index.html'));
//   });
// }

// // Attach the CSRF token to a specific route in development
if (process.env.NODE_ENV !== 'production') {
  router.get('/api/csrf/restore', async (c: Context) => {
    // c.res.cookie("XSRF-TOKEN", c.req.csrfToken());
    return c.res.status(201).json({});
  });
}

export default router;
