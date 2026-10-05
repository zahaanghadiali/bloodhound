const otpService = require('../services/otpService');
const geoService = require('../services/geoService');
const { maskPhone, maskEmail } = require('../utils/mask');
const { defaultCountryCallingCode } = require('../config/env');

/**
 * Extracts the trimmed text of an incoming message.
 * @param {{text: (string|undefined)}} input Normalized incoming message.
 * @return {string} The trimmed text, or an empty string.
 */
function normalizeText(input) {
  return (input.text || '').trim();
}

const DEFAULT_CONFIRM_OPTIONS = [
  { value: true, label: '✅ Yes', keywords: ['yes', 'y', 'yep'] },
  { value: false, label: '❌ No', keywords: ['no', 'n', 'nope'] },
];

/**
 * Finds the option a user picked: by button payload, 1-based index, exact
 * value, or a keyword contained in the text. Payloads and values are compared
 * as strings because real channels echo reply ids back as strings.
 * @param {Object} input Normalized incoming message.
 * @param {{options: Array<Object>}} step Step with its options resolved.
 * @return {?Object} The matching option, or null.
 */
function matchChoice(input, step) {
  const raw = normalizeText(input).toLowerCase();
  const hasPayload = input.payload !== undefined && input.payload !== null;
  const byPayload = hasPayload && step.options.find((o) => String(o.value) === String(input.payload));
  if (byPayload) return byPayload;

  const byIndex = step.options[parseInt(raw, 10) - 1];
  if (raw && !Number.isNaN(parseInt(raw, 10)) && byIndex) return byIndex;

  const byValue = step.options.find((o) => String(o.value).toLowerCase() === raw);
  if (byValue) return byValue;

  const byKeyword = step.options.find((o) =>
    (o.keywords || []).some((k) => raw.includes(k.toLowerCase()))
  );
  return byKeyword || null;
}

const validators = {
  /**
   * Validates a pick from a step's options.
   * @param {Object} input Normalized incoming message.
   * @param {{options: Array<Object>}} step Step with its options resolved.
   * @return {{valid: boolean, value: *, error: (string|undefined)}} The chosen
   *     option's value, or an error listing the valid choices.
   */
  choice(input, step) {
    const match = matchChoice(input, step);
    if (!match) {
      return { valid: false, error: `Please choose one of: ${step.options.map((o) => o.label).join(', ')}` };
    }
    return { valid: true, value: match.value };
  },

  /**
   * Validates a yes/no answer, using the step's optionsOverride when it has
   * one.
   * @param {Object} input Normalized incoming message.
   * @param {Object} step Step definition.
   * @return {{valid: boolean, value: *, error: (string|undefined)}} The chosen
   *     option's value, or an error.
   */
  confirm(input, step) {
    return validators.choice(input, { options: step.optionsOverride || DEFAULT_CONFIRM_OPTIONS });
  },

  /**
   * Validates a non-empty free-text answer.
   * @param {Object} input Normalized incoming message.
   * @return {{valid: boolean, value: (string|undefined), error:
   *     (string|undefined)}} The trimmed text, or an error.
   */
  text(input) {
    const value = normalizeText(input);
    if (!value) return { valid: false, error: 'Please type a response.' };
    return { valid: true, value };
  },

  /**
   * Validates a phone number and canonicalizes it, so the same number typed
   * with or without a country code always resolves to the same account. A bare
   * 10-digit number gets the default country calling code.
   * @param {Object} input Normalized incoming message.
   * @return {{valid: boolean, value: (string|undefined), error:
   *     (string|undefined)}} The number in "+<digits>" form, or an error.
   */
  phone(input) {
    const raw = normalizeText(input).replace(/[\s-]/g, '');
    if (!/^\+?[0-9]{7,15}$/.test(raw)) {
      return { valid: false, error: 'That doesn’t look like a valid phone number. Please try again.' };
    }
    const value = raw.startsWith('+')
      ? raw
      : raw.length === 10
        ? `${defaultCountryCallingCode}${raw}`
        : `+${raw}`;
    return { valid: true, value };
  },

  /**
   * Validates an email address.
   * @param {Object} input Normalized incoming message.
   * @return {{valid: boolean, value: (string|undefined), error:
   *     (string|undefined)}} The lower-cased address, or an error.
   */
  email(input) {
    const value = normalizeText(input);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return { valid: false, error: 'That doesn’t look like a valid email. Please try again.' };
    }
    return { valid: true, value: value.toLowerCase() };
  },

  /**
   * Validates an optional pet photo. An attached image wins; typing "skip"
   * stores no photo.
   * @param {Object} input Normalized incoming message.
   * @return {{valid: boolean, value: ?string, error: (string|undefined)}} The
   *     image data URL, null when skipped, or an error.
   */
  photo(input) {
    const attachment = input.attachment;
    if (attachment && attachment.type === 'image' && typeof attachment.dataUrl === 'string' && attachment.dataUrl.startsWith('data:image/')) {
      return { valid: true, value: attachment.dataUrl };
    }
    const raw = normalizeText(input).toLowerCase();
    if (raw === 'skip' || raw === 'no' || raw === 'no photo') {
      return { valid: true, value: null };
    }
    return { valid: false, error: 'Please attach a photo, or type "skip" to use a paw icon instead.' };
  },

  /**
   * Validates a positive number, accepting a comma as the decimal separator.
   * @param {Object} input Normalized incoming message.
   * @return {{valid: boolean, value: (number|undefined), error:
   *     (string|undefined)}} The parsed number, or an error.
   */
  number(input) {
    const value = parseFloat(normalizeText(input).replace(',', '.'));
    if (Number.isNaN(value) || value <= 0) {
      return { valid: false, error: 'Please enter a positive number.' };
    }
    return { valid: true, value };
  },

  /**
   * Validates a date that is not in the future.
   * @param {Object} input Normalized incoming message.
   * @return {{valid: boolean, value: (Date|undefined), error:
   *     (string|undefined)}} The parsed date, or an error.
   */
  date(input) {
    const raw = normalizeText(input);
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      return { valid: false, error: 'Please enter a date like 15/03/2022 or 2022-03-15.' };
    }
    if (parsed.getTime() > Date.now()) {
      return { valid: false, error: 'That date is in the future — please double check.' };
    }
    return { valid: true, value: parsed };
  },

  /**
   * Verifies a code sent by an earlier step's onEnter hook. Typing "resend"
   * issues a new code instead, reported back as an error so the step is shown
   * again.
   * @param {Object} input Normalized incoming message.
   * @param {{field: string, sourceStepId: string}} step Step definition; field
   *     is 'phone' or 'email' and sourceStepId names the step whose answer
   *     holds the target being verified.
   * @param {Object} conversation Conversation document.
   * @return {Promise<{valid: boolean, value: (Date|undefined), error:
   *     (string|undefined)}>} The verification time, or an error.
   * @throws {Error} If the OTP provider fails to deliver a resent code.
   */
  async otp(input, step, conversation) {
    const raw = normalizeText(input).toLowerCase();
    const target = conversation.answers.get(step.sourceStepId);
    const mask = step.field === 'phone' ? maskPhone : maskEmail;

    if (raw === 'resend' || raw === 'resend code') {
      const result = await otpService.resend({
        channel: conversation.channel,
        externalUserId: conversation.externalUserId,
        field: step.field,
        target,
      });
      if (!result.ok) return { valid: false, error: result.error };
      const hint = result.devCode ? ` 🧪 Dev mode — your code is ${result.devCode}` : '';
      return { valid: false, error: `Sent a new code to ${mask(target)}.${hint}` };
    }

    const code = normalizeText(input).replace(/\s/g, '');
    if (!/^\d{4,8}$/.test(code)) {
      return { valid: false, error: 'Please enter the numeric code we sent you, or type "resend".' };
    }

    const result = await otpService.verifyCode({
      channel: conversation.channel,
      externalUserId: conversation.externalUserId,
      field: step.field,
      code,
    });
    if (!result.ok) return { valid: false, error: result.error };
    return { valid: true, value: result.verifiedAt };
  },

  /**
   * Validates a shared location or a typed city or area. Coordinates come back
   * as a GeoJSON point with a resolved address; text is accepted only when the
   * step does not set requireCoordinates.
   * @param {Object} input Normalized incoming message.
   * @param {{requireCoordinates: (boolean|undefined)}=} step Step definition.
   * @return {Promise<{valid: boolean, value: (Object|undefined), error:
   *     (string|undefined)}>} A {type: 'Point', coordinates, address, text} or
   *     {type: 'text', text} value, or an error.
   */
  async location(input, step) {
    if (input.location && typeof input.location.lat === 'number' && typeof input.location.lng === 'number') {
      const { lat, lng, label, city, country, countryCode } = input.location;
      const address = city
        ? { area: null, city, state: null, country: country || null, countryCode: countryCode || null }
        : await geoService.reverseGeocode(lat, lng);
      return {
        valid: true,
        value: {
          type: 'Point',
          coordinates: [lng, lat],
          address,
          text: geoService.formatAddress(address) || label || null,
        },
      };
    }
    if (step?.requireCoordinates) {
      return {
        valid: false,
        error: 'Please share your location, or pick your city from the list below, so nearby matches can find you.',
      };
    }
    const text = normalizeText(input);
    if (!text) {
      return { valid: false, error: 'Please share your location or type your city/area.' };
    }
    return { valid: true, value: { type: 'text', text } };
  },
};

/**
 * Returns the quick-reply options a step should render with its prompt.
 * @param {Object} step Step with its options resolved.
 * @return {?Array<Object>} The options for choice and confirm steps, null for
 *     every other type.
 */
function getOptions(step) {
  if (step.type === 'choice') return step.options;
  if (step.type === 'confirm') return step.optionsOverride || DEFAULT_CONFIRM_OPTIONS;
  return null;
}

module.exports = { validators, getOptions };
