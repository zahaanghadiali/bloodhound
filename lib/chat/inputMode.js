/**
 * Best-effort hints for adapting the input bar to the step currently being
 * asked, inferred from the bot's own prompt text (the API doesn't expose a
 * step "type" directly).
 */
export function inferInputMode(promptText = '') {
  const t = promptText.toLowerCase();
  if (/birthday|born/.test(t)) return 'date';
  if (/phone/.test(t)) return 'tel';
  if (/email/.test(t)) return 'email';
  if (/weigh/.test(t)) return 'number';
  return 'text';
}

export function isLocationPrompt(promptText = '') {
  const t = promptText.toLowerCase();
  return t.includes('location') || promptText.includes('📍');
}
