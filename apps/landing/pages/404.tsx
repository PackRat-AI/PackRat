// Overrides Next.js internal _error page for /404 during static export.
// Without this, Next.js 15.4.x uses _error.js (react-server build, no hooks)
// for error pages, causing useContext to be null and the build to fail.
export default function Custom404() {
  return null;
}
