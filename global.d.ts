// Ambient declaration for side-effect CSS imports (`import './foo.css';`).
// Next.js' bundler handles these at runtime. Next's own type package only
// declares `*.module.css` (CSS Modules) in next-env.d.ts, not plain side-effect
// imports, so running the monorepo-wide `tsc --noEmit` (which doesn't load the
// Next TS plugin) needs this shim.
declare module '*.css';
