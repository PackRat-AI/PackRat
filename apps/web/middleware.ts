import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const accessToken = request.cookies.get('access_token');
  const isAuthPage = request.nextUrl.pathname.startsWith('/auth');

  if (!accessToken && !isAuthPage) {
    return NextResponse.redirect(new URL('/auth', request.url));
  }

  if (accessToken && isAuthPage) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
