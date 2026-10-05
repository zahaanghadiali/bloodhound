import { NextResponse } from 'next/server';
import { SESSION_COOKIE, verifySession } from './server/utils/jwt';

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

/**
 * Checks whether an API path is reachable without a signed-in session.
 * @param {string} pathname Request path, for example '/api/health'.
 * @return {boolean} True if the path matches a public API pattern.
 */
function isPublic(pathname) {
  return PUBLIC_API_PATTERNS.some((pattern) => pattern.test(pathname));
}

/**
 * Verifies the session JWT on every non-public /api/* request and forwards the
 * authenticated identity to route handlers through x-user-* headers, so
 * controllers never trust an owner id supplied by the client.
 * @param {Object} request Incoming Next.js request.
 * @return {Object} A pass-through response, or a 401 JSON response when the
 *     session is missing or invalid.
 * @throws {Error} If JWT_SECRET is not set.
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
