const otpService = require('../services/otpService');
const { maskPhone } = require('../utils/mask');

const MAX_RADIUS_OPTIONS = [
  { value: 10, label: 'Within 10 km', keywords: ['10'] },
  { value: 25, label: 'Within 25 km', keywords: ['25'] },
  { value: 50, label: 'Within 50 km', keywords: ['50'] },
  { value: 100, label: 'Within 100 km', keywords: ['100'] },
];

/**
 * Picks the emoji shown next to a pet of a given species.
 * @param {string} species 'dog' or 'cat'.
 * @return {string} A dog emoji for dogs, a cat emoji otherwise.
 */
const speciesEmoji = (species) => (species === 'dog' ? '🐶' : '🐱');

/**
 * Finds the registered pet chosen in the `pet` step, from the list the flow was
 * seeded with.
 * @param {{myPets: (Array<Object>|undefined), pet: (string|undefined)}} answers
 *     Answers collected so far.
 * @return {?Object} The chosen pet, or null if none matches.
 */
function selectedPet(answers) {
  return (answers.myPets || []).find((p) => p.id === answers.pet) || null;
}

/**
 * Decides where the flow goes once the search area is settled. The name is
 * asked only if unknown, and the phone and OTP steps only if there is no
 * verified number (WhatsApp always proves it).
 * @param {Object} answers Answers collected so far.
 * @param {Object} conversation Conversation document.
 * @return {?string} Id of the next step, or null to finish the flow.
 */
function afterLocation(answers, conversation) {
  if (!answers.parentName) return 'parentName';
  return answers.parentPhoneOtp || conversation.channel === 'whatsapp' ? null : 'parentPhone';
}

const steps = [
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
    next: () => null,
  },
];

module.exports = {
  id: 'findDonor',
  openingMessage: 'Sniffing out matches near you 🐾',
  steps,
  firstStepId: 'species',
};
