const jwt = require('jsonwebtoken');

const SESSION_COOKIE = 'bh_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

function secret() {
  const value = process.env.JWT_SECRET;
  if (!value) throw new Error('JWT_SECRET is not set');
  return value;
}

/** Issues a session token for a signed-in PetParent. */
function signSession({ parentId, phone, channel, externalUserId }) {
  return jwt.sign(
    { sub: String(parentId), phone, channel, externalUserId },
    secret(),
    { expiresIn: SESSION_TTL_SECONDS }
  );
}

/** Returns the decoded payload, or null if the token is missing/invalid/expired. */
function verifySession(token) {
  if (!token) return null;
  try {
    return jwt.verify(token, secret());
  } catch {
    return null;
  }
}

module.exports = { SESSION_COOKIE, SESSION_TTL_SECONDS, signSession, verifySession };
