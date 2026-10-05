/**
 * Partially obscures a phone number for display in a chat bubble.
 * @param {?string} phone Phone number to mask.
 * @return {string} The number with only its first and last digits visible, or
 *     unchanged when it is 5 characters or shorter.
 */
function maskPhone(phone) {
  const value = String(phone || '');
  if (value.length <= 5) return value;
  const head = value.slice(0, value.startsWith('+') ? 3 : 2);
  const tail = value.slice(-2);
  return `${head}${'•'.repeat(Math.max(3, value.length - head.length - tail.length))}${tail}`;
}

/**
 * Partially obscures an email address for display in a chat bubble.
 * @param {?string} email Email address to mask.
 * @return {string} The address with all but the first two characters of the
 *     local part hidden, or unchanged when it has no domain.
 */
function maskEmail(email) {
  const value = String(email || '');
  const [user, domain] = value.split('@');
  if (!domain) return value;
  const visible = user.slice(0, Math.min(2, user.length));
  return `${visible}${'•'.repeat(Math.max(3, user.length - visible.length))}@${domain}`;
}

module.exports = { maskPhone, maskEmail };
