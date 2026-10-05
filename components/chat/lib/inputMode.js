/**
 * Guesses the best input mode for the step being asked from the bot's prompt
 * text, since the API does not expose the step type.
 * @param {string=} promptText Text of the bot's latest prompt.
 * @return {string} One of 'otp', 'date', 'tel', 'email', 'number' or 'text'.
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

/**
 * Checks whether a prompt asks the user to share a location.
 * @param {string=} promptText Text of the bot's latest prompt.
 * @return {boolean} True if it is a location prompt.
 */
export function isLocationPrompt(promptText = '') {
  return /share (your )?location/i.test(promptText);
}

/**
 * Checks whether a prompt asks for a verification code.
 * @param {string=} promptText Text of the bot's latest prompt.
 * @return {boolean} True if it is an OTP prompt.
 */
export function isOtpPrompt(promptText = '') {
  return /enter the code|verification code/i.test(promptText);
}

/**
 * Checks whether a prompt asks for a pet photo.
 * @param {string=} promptText Text of the bot's latest prompt.
 * @return {boolean} True if it is a photo prompt.
 */
export function isPhotoPrompt(promptText = '') {
  return /got a photo of them/i.test(promptText);
}

/**
 * Checks whether a prompt asks the user to attach a file.
 * @param {string=} promptText Text of the bot's latest prompt.
 * @return {boolean} True if it is a file prompt.
 */
export function isFilePrompt(promptText = '') {
  return /attach (a|another) file/i.test(promptText);
}
