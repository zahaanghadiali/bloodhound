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

const speciesEmoji = (species) => (species === 'dog' ? '🐶' : '🐱');

/** The registered pet picked (or auto-picked) in the `pet` step, from the list messageProcessor seeds the flow with. */
function selectedPet(answers) {
  return (answers.myPets || []).find((p) => p.id === answers.pet) || null;
}

/**
 * Where to go once the search area is settled. The searcher's name is asked
 * only if messageProcessor didn't already seed it from their profile; and
 * WhatsApp already proves the sender's number on every message, so the
 * phone + OTP steps are skipped there (messageProcessor fills both in) —
 * which, with a known name, ends the flow right here.
 */
function afterLocation(answers, conversation) {
  if (!answers.parentName) return 'parentName';
  return conversation.channel === 'whatsapp' ? null : 'parentPhone';
}

const steps = [
  // --- Registered owners only: messageProcessor seeds `myPets` (and starts
  // the flow here, or at `locationChoice` if there's just one pet) so they
  // pick a pet instead of re-entering its species and where it lives.
  // Everyone else starts at `species` below.
  {
    id: 'pet',
    type: 'choice',
    options: (answers) => (answers.myPets || []).map((p) => ({ value: p.id, label: `${speciesEmoji(p.species)} ${p.name}` })),
    listButton: 'View Pets',
    prompt: () => 'Which of your pets needs a donor?',
    next: (answers) => (selectedPet(answers)?.location ? 'locationChoice' : 'location'),
  },
  {
    id: 'locationChoice',
    type: 'choice',
    options: [
      { value: 'saved', label: '📍 Saved location', keywords: ['saved', 'stored', 'current', 'same'] },
      { value: 'new', label: '🗺️ New location', keywords: ['new', 'share', 'different', 'other'] },
    ],
    prompt: (answers) => {
      const pet = selectedPet(answers);
      return (
        `Where should we look for a donor for ${pet?.name || 'your pet'}?\n` +
        `📍 Saved location — ${pet?.location?.text || 'the one on their profile'}\n` +
        '🗺️ New location — just for this search, their profile stays as it is'
      );
    },
    next: (answers) => (answers.locationChoice === 'saved' ? 'maxRadius' : 'location'),
  },
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
    next: (answers, conversation) => (answers.location?.type === 'Point' ? 'maxRadius' : afterLocation(answers, conversation)),
  },
  {
    id: 'maxRadius',
    type: 'choice',
    options: MAX_RADIUS_OPTIONS,
    prompt: () =>
      "We'll start with a small radius and widen it automatically every few minutes if nobody's replied yet. How far should we go at most before checking in with you?",
    next: afterLocation,
  },
  {
    id: 'parentName',
    type: 'text',
    section: 'petParent',
    prompt: () => "Last thing — donors will see this so they know who's asking. What's your name?",
    next: afterLocation,
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
