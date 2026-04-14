import { type NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/login', '/_next', '/favicon.ico', '/PackRat.ico'];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  // ── Cloudflare Zero Trust ──────────────────────────────────────────────────
  // When deployed behind Cloudflare Access, every authenticated request carries
  // this header. Trust it unconditionally — Cloudflare has already verified the
  // identity at the edge before the request reaches the origin.
  const cfEmail = request.headers.get('cf-access-authenticated-user-email');
  if (cfEmail) {
    return NextResponse.next();
  }

  // ── Dev / fallback session cookie ─────────────────────────────────────────
  // Set by the /login server action after verifying ADMIN_USERNAME/ADMIN_PASSWORD.
  const session = request.cookies.get('admin-session');
  if (session?.value) {
    // Re-derive the expected token from env so we can validate without a DB.
    const username = process.env.ADMIN_USERNAME ?? '';
    const password = process.env.ADMIN_PASSWORD ?? '';
    if (username && password) {
      const expected = Buffer.from(`${username}:${password}`).toString('base64');
      if (session.value === expected) {
        return NextResponse.next();
      }
    }
  }

  // ── Unauthenticated ────────────────────────────────────────────────────────
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('from', pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|PackRat\\.ico).*)'],
};
