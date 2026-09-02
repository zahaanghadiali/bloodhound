/**
 * Validators for each step "type" used in flow definitions.
 * Each validator receives the raw normalized input `{ text, location, payload }`
 * and the step definition, and returns { valid, value, error }.
 */

const otpService = require('../services/otpService');
const { maskPhone, maskEmail } = require('../utils/mask');

function normalizeText(input) {
  return (input.text || '').trim();
}

const DEFAULT_CONFIRM_OPTIONS = [
  { value: true, label: '✅ Yes', keywords: ['yes', 'y', 'yep'] },
  { value: false, label: '❌ No', keywords: ['no', 'n', 'nope'] },
];

function matchChoice(input, step) {
  const raw = normalizeText(input).toLowerCase();
  const byPayload = input.payload && step.options.find((o) => o.value === input.payload);
  if (byPayload) return byPayload;

  // match by 1-based index ("1", "2"), exact value, or keyword contained in the option label
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
  choice(input, step) {
    const match = matchChoice(input, step);
    if (!match) {
      return { valid: false, error: `Please choose one of: ${step.options.map((o) => o.label).join(', ')}` };
    }
    return { valid: true, value: match.value };
  },

  confirm(input, step) {
    return validators.choice(input, { options: step.optionsOverride || DEFAULT_CONFIRM_OPTIONS });
  },

  text(input) {
    const value = normalizeText(input);
    if (!value) return { valid: false, error: 'Please type a response.' };
    return { valid: true, value };
  },

  phone(input) {
    const value = normalizeText(input).replace(/[\s-]/g, '');
    if (!/^\+?[0-9]{7,15}$/.test(value)) {
      return { valid: false, error: 'That doesn’t look like a valid phone number. Please try again.' };
    }
    return { valid: true, value };
  },

  email(input) {
    const value = normalizeText(input);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return { valid: false, error: 'That doesn’t look like a valid email. Please try again.' };
    }
    return { valid: true, value: value.toLowerCase() };
  },

  number(input) {
    const value = parseFloat(normalizeText(input).replace(',', '.'));
    if (Number.isNaN(value) || value <= 0) {
      return { valid: false, error: 'Please enter a positive number.' };
    }
    return { valid: true, value };
  },

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
   * Verifies a code sent by a prior step's onEnter hook. `step.field` is
   * 'phone' | 'email', `step.sourceStepId` names the step whose answer holds
   * the target being verified. Typing "resend" issues a new code instead of
   * validating one.
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
   * `step.requireCoordinates` (used by registerDonor, since donor search
   * depends on it) rejects a typed city with no coordinates instead of
   * falling back to text-only, so a donor profile can't be created without
   * a location that radius search can actually use.
   */
  location(input, step) {
    if (input.location && typeof input.location.lat === 'number' && typeof input.location.lng === 'number') {
      return {
        valid: true,
        value: {
          type: 'Point',
          coordinates: [input.location.lng, input.location.lat],
          text: input.location.label || null,
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

/** The quick-reply buttons a step should render alongside its prompt, if any. */
function getOptions(step) {
  if (step.type === 'choice') return step.options;
  if (step.type === 'confirm') return step.optionsOverride || DEFAULT_CONFIRM_OPTIONS;
  return null;
}

module.exports = { validators, getOptions };
