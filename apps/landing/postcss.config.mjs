/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    // postcss-import must run before tailwindcss so that `@import` statements
    // in app globals.css (e.g. pulling in @packrat/web-ui/styles/globals.css)
    // are inlined before tailwindcss parses `@tailwind` / `@layer` directives.
    'postcss-import': {},
    tailwindcss: {},
  },
};

export default config;
