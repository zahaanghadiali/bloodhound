const jwt = require('jsonwebtoken');

const SESSION_COOKIE = 'bh_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

/**
 * Reads the secret used to sign and verify session tokens.
 * @return {string} The configured JWT secret.
 * @throws {Error} If JWT_SECRET is not set.
 */
function secret() {
  const value = process.env.JWT_SECRET;
  if (!value) throw new Error('JWT_SECRET is not set');
  return value;
}

/**
 * Issues a session token for a signed-in pet parent.
 * @param {{parentId: (string|Object), phone: string, channel: string,
 *     externalUserId: string}} session Identity to embed in the token; parentId
 *     becomes the subject.
 * @return {string} Signed JWT valid for SESSION_TTL_SECONDS (30 days).
 * @throws {Error} If JWT_SECRET is not set.
 */
function signSession({ parentId, phone, channel, externalUserId }) {
  return jwt.sign(
    { sub: String(parentId), phone, channel, externalUserId },
    secret(),
    { expiresIn: SESSION_TTL_SECONDS }
  );
}

/**
 * Decodes and validates a session token.
 * @param {?string} token Session JWT, typically read from the session cookie.
 * @return {?Object} The decoded payload, or null if the token is missing,
 *     invalid or expired.
 * @throws {Error} If JWT_SECRET is not set.
 */
function verifySession(token) {
  if (!token) return null;
  try {
    return jwt.verify(token, secret());
  } catch {
    return null;
  }
}

module.exports = { SESSION_COOKIE, SESSION_TTL_SECONDS, signSession, verifySession };
