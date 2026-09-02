/** Partially obscure a phone/email for display in a chat bubble ("we sent a code to ..."). */
function maskPhone(phone) {
  const value = String(phone || '');
  if (value.length <= 5) return value;
  const head = value.slice(0, value.startsWith('+') ? 3 : 2);
  const tail = value.slice(-2);
  return `${head}${'•'.repeat(Math.max(3, value.length - head.length - tail.length))}${tail}`;
}

function maskEmail(email) {
  const value = String(email || '');
  const [user, domain] = value.split('@');
  if (!domain) return value;
  const visible = user.slice(0, Math.min(2, user.length));
  return `${visible}${'•'.repeat(Math.max(3, user.length - visible.length))}@${domain}`;
}

module.exports = { maskPhone, maskEmail };
