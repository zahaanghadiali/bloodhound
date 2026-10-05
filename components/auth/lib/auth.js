const STORAGE_KEY = 'bloodhound.auth';

/**
 * Reads the signed-in account stored on this device.
 * @return {?Object} The stored account, or null when signed out, on the server,
 *     or if the stored value is unreadable.
 */
export function getAuth() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Stores the signed-in account on this device. Does nothing on the server.
 * @param {{phone: string, name: ?string, parentId: string, externalUserId:
 *     string, verifiedAt: string}} auth Account details to remember.
 */
export function setAuth(auth) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
}

/**
 * Removes the signed-in account from this device. Does nothing on the server.
 */
export function clearAuth() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
}
