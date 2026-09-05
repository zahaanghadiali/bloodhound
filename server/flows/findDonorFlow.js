/**
 * "Find a pet blood donor" flow.
 */

const otpService = require('../services/otpService');
const { maskPhone } = require('../utils/mask');

const MAX_RADIUS_OPTIONS = [
  { value: 10, label: 'Within 10 km', keywords: ['10'] },
  { value: 25, label: 'Within 25 km', keywords: ['25'] },
  { value: 50, label: 'Within 50 km', keywords: ['50'] },
  { value: 100, label: 'Within 100 km', keywords: ['100'] },
];

const steps = [
  {
    id: 'species',
    type: 'choice',
    options: [
      { value: 'dog', label: '🐶 Dog', keywords: ['dog'] },
      { value: 'cat', label: '🐱 Cat', keywords: ['cat'] },
    ],
    prompt: () => "Who's this for?\n🐶 Dog\n🐱 Cat",
    next: () => 'location',
  },
  {
    id: 'location',
    type: 'location',
    prompt: () =>
      'Where should we look?\nShare your location 📍 or pick your city from the list for a radius search that widens automatically — or just type a city/area name (e.g. "Bandra, Mumbai") for a simple search, handy if you\'re sharing this with someone who hasn\'t shared their pin.',
    // A shared pin/picked city carries real coordinates -> radius search
    // (see maxRadius next). Plain typed text has none -> simple text search,
    // which skips maxRadius entirely since there's no distance to cap.
    next: (answers) => (answers.location?.type === 'Point' ? 'maxRadius' : 'parentName'),
  },
  {
    id: 'maxRadius',
    type: 'choice',
    options: MAX_RADIUS_OPTIONS,
    prompt: () =>
      "We'll start with a small radius and widen it automatically every few minutes if nobody's replied yet. How far should we go at most before checking in with you?",
    next: () => 'parentName',
  },
  {
    id: 'parentName',
    type: 'text',
    section: 'petParent',
    prompt: () => "Last thing — donors will see this so they know who's asking. What's your name?",
    next: () => 'parentPhone',
  },
  {
    id: 'parentPhone',
    type: 'phone',
    section: 'petParent',
    prompt: () => 'And your phone number (with country code, e.g. +91 98765 43210), so a donor who says yes can reach you? 📞',
    next: () => 'parentPhoneOtp',
  },
  {
    id: 'parentPhoneOtp',
    type: 'otp',
    field: 'phone',
    sourceStepId: 'parentPhone',
    section: 'petParent',
    onEnter: async (answers, conversation) => {
      const target = answers.parentPhone;
      const { devCode } = await otpService.issueChallenge({
        channel: conversation.channel,
        externalUserId: conversation.externalUserId,
        field: 'phone',
        target,
      });
      const hint = devCode ? ` 🧪 Dev mode — your code is ${devCode}` : '';
      return `We just texted a 6-digit code to ${maskPhone(target)}.${hint}`;
    },
    prompt: () => 'Enter the code below, or type "resend" if it doesn\'t arrive.',
    next: () => null, // end of flow -> triggers the expanding-radius donor search
  },
];

module.exports = {
  id: 'findDonor',
  openingMessage: 'Sniffing out matches near you 🐾',
  steps,
  firstStepId: 'species',
};
