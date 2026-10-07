import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

/** Paths anyone may open without signing in: shared-post pages and Apple's universal-link file. */
const PUBLIC_PREFIXES = ['/p/', '/.well-known/'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  const accessToken = request.cookies.get('access_token');
  const isAuthPage = pathname.startsWith('/auth');

  if (!accessToken && !isAuthPage) {
    return NextResponse.redirect(new URL('/auth', request.url));
  }

  if (accessToken && isAuthPage) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Static icons in public/ are skipped so signed-out pages (the share page) can show the logo.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|ico)$).*)'],
};
