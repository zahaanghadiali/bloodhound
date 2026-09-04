/**
 * Best-effort hints for adapting the input bar to the step currently being
 * asked, inferred from the bot's own prompt text (the API doesn't expose a
 * step "type" directly).
 */
export function inferInputMode(promptText = '') {
  const t = promptText.toLowerCase();
  if (/enter the code|verification code/.test(t)) return 'otp';
  if (/birthday|born/.test(t)) return 'date';
  if (/phone/.test(t)) return 'tel';
  if (/email/.test(t)) return 'email';
  if (/weigh/.test(t)) return 'number';
  return 'text';
}

export function isLocationPrompt(promptText = '') {
  return /share (your )?location/i.test(promptText);
}

export function isOtpPrompt(promptText = '') {
  return /enter the code|verification code/i.test(promptText);
}

export function isPhotoPrompt(promptText = '') {
  return /got a photo of them/i.test(promptText);
}

export function isFilePrompt(promptText = '') {
  return /attach (a|another) file/i.test(promptText);
}
