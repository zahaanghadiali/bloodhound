import { getAuth } from '@/components/auth/lib/auth';

let anonymousId = null;

/**
 * Generates a random id for an anonymous chat session.
 * @return {string} A UUID, or a timestamp-based id where crypto.randomUUID is
 *     unavailable.
 */
function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `web-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Returns the identity used for chat requests: the signed-in account's own id,
 * or an anonymous id that lasts for one page load.
 * @return {?string} The external user id, or null on the server.
 */
export function getExternalUserId() {
  if (typeof window === 'undefined') return null;
  const auth = getAuth();
  if (auth?.externalUserId) return auth.externalUserId;
  if (!anonymousId) anonymousId = generateId();
  return anonymousId;
}

/**
 * Starts a brand-new anonymous identity. Call it right after sign-out.
 * @return {string} The new anonymous id.
 */
export function resetExternalUserId() {
  anonymousId = generateId();
  return anonymousId;
}
