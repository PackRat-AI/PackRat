// This file exists to override Next.js's internal _error page during static
// export. The built-in _error.js uses useContext with the react-server
// condition active in the static generation worker, which strips useContext
// and causes the build to fail.
export default function Custom404() {
  return null;
}
