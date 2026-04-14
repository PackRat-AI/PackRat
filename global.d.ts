// Ambient declaration for side-effect CSS imports (`import './foo.css';`).
// Next.js' bundler handles these at runtime; Next's own types in
// node_modules/next/types/global.d.ts only declare `*.module.css` (CSS Modules),
// not plain side-effect CSS. The monorepo-wide `tsc --noEmit` run from root
// doesn't load the Next TS plugin, so this ambient is necessary.
declare module '*.css';
