/**
 * Validators for each step "type" used in flow definitions.
 * Each validator receives the raw normalized input `{ text, location, payload }`
 * and the step definition, and returns { valid, value, error }.
 */

function normalizeText(input) {
  return (input.text || '').trim();
}

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
    return validators.choice(input, {
      options: step.optionsOverride || [
        { value: true, label: '✅ Yes', keywords: ['yes', 'y', 'yep'] },
        { value: false, label: '❌ No', keywords: ['no', 'n', 'nope'] },
      ],
    });
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

  location(input) {
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
    const text = normalizeText(input);
    if (!text) {
      return { valid: false, error: 'Please share your location or type your city/area.' };
    }
    return { valid: true, value: { type: 'text', text } };
  },
};

module.exports = validators;
