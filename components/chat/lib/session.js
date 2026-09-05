import { getAuth } from '@/components/auth/lib/auth';

// Not persisted to localStorage on purpose: an anonymous (not signed in)
// chat identity is scratch, good for one page load only. Otherwise stale
// test data typed into the bot (e.g. a name/phone for someone else) could
// sit around and later get silently absorbed into a real signed-in account
// on the same browser — that's the bug this replaced.
let anonymousId = null;

function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `web-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * The identity used for /api/mock/incoming. While signed in, this is always
 * the authenticated account's own externalUserId (see auth.js/AuthPage),
 * so chat activity never forks away from — or gets merged into — the
 * wrong PetParent. Signing out or a hard page reload starts a fresh
 * anonymous scratch identity (see resetExternalUserId).
 */
export function getExternalUserId() {
  if (typeof window === 'undefined') return null;
  const auth = getAuth();
  if (auth?.externalUserId) return auth.externalUserId;
  if (!anonymousId) anonymousId = generateId();
  return anonymousId;
}

/** Forces a brand-new anonymous scratch identity — call this right after sign-out. */
export function resetExternalUserId() {
  anonymousId = generateId();
  return anonymousId;
}
