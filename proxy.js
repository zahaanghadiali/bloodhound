import { NextResponse } from 'next/server';
import { SESSION_COOKIE, verifySession } from './server/utils/jwt';

/**
 * Endpoints reachable without a signed-in session: the auth flow itself,
 * inbound channel webhooks/simulation (authenticated by their own
 * verify-token/signature checks, not a user session), and static geo lookups.
 */
const PUBLIC_API_PATTERNS = [
  /^\/api\/health$/,
  /^\/api\/auth\/request-otp$/,
  /^\/api\/auth\/resend-otp$/,
  /^\/api\/auth\/verify-otp$/,
  /^\/api\/auth\/logout$/,
  /^\/api\/webhooks\//,
  /^\/api\/mock\/incoming$/,
  /^\/api\/geo\//,
  /^\/api\/donor-requests\/tick$/,
];

function isPublic(pathname) {
  return PUBLIC_API_PATTERNS.some((pattern) => pattern.test(pathname));
}

/**
 * Verifies the session JWT for every other /api/* request and forwards the
 * authenticated identity to route handlers via x-user-* headers, so
 * controllers never have to trust an owner/parentId supplied by the client.
 */
export function proxy(request) {
  const { pathname } = request.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = verifySession(token);
  if (!session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-id', session.sub);
  requestHeaders.set('x-user-phone', session.phone || '');
  requestHeaders.set('x-user-channel', session.channel || '');
  requestHeaders.set('x-user-external-id', session.externalUserId || '');

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ['/api/:path*'],
};
