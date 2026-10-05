/**
 * "Register your pet as a blood donor" flow.
 * Declarative step list — the engine walks these in order (with one branch
 * for blood type), validating and storing each answer under its id.
 */

const otpService = require('../services/otpService');
const { maskPhone, maskEmail } = require('../utils/mask');

const SPECIES_OPTIONS = [
  { value: 'dog', label: '🐶 Dog', keywords: ['dog'] },
  { value: 'cat', label: '🐱 Cat', keywords: ['cat'] },
];

const SEX_OPTIONS = [
  { value: 'male', label: '♂️ Male', keywords: ['male', 'boy'] },
  { value: 'female', label: '♀️ Female', keywords: ['female', 'girl'] },
];

/**
 * The "about you" half of the flow, in order, each with the condition under
 * which it's skipped. messageProcessor seeds the flow with whatever a
 * returning owner's profile already has (flowStartOptions), so registering
 * a second pet doesn't re-ask their name, re-verify their phone (never
 * asked on WhatsApp — the channel proves it on every message) or email, or
 * make them share a location again unless they want a different one.
 * A step listed here stands for its whole pair: skipping `parentPhone`
 * skips its OTP step too.
 */
const OWNER_STEPS = [
  { id: 'parentName', skip: (answers) => !!answers.parentName },
  { id: 'parentPhone', skip: (answers, conversation) => !!answers.parentPhoneOtp || conversation.channel === 'whatsapp' },
  { id: 'parentEmail', skip: (answers) => !!answers.parentEmailOtp },
  { id: 'locationChoice', skip: (answers) => !answers.savedLocation },
  { id: 'parentLocation', skip: (answers) => answers.locationChoice === 'saved' },
];

/** `next` for a step: the first owner step after `afterId` (from the top if null) that still needs asking, or null to finish. */
function nextOwnerStep(afterId) {
  const from = afterId ? OWNER_STEPS.findIndex((s) => s.id === afterId) + 1 : 0;
  return (answers, conversation) => OWNER_STEPS.slice(from).find((s) => !s.skip(answers, conversation))?.id || null;
}

const steps = [
  {
    id: 'species',
    type: 'choice',
    options: SPECIES_OPTIONS,
    prompt: () => 'First things first… who are we saying hello to?\n🐶 Dog\n🐱 Cat',
    next: () => 'sex',
  },
  {
    id: 'sex',
    type: 'choice',
    options: SEX_OPTIONS,
    prompt: () => "Boy or girl?\n♂️ Male\n♀️ Female",
    next: () => 'name',
  },
  {
    id: 'name',
    type: 'text',
    prompt: () => "And what's this good boy/girl's name? ❤️",
    next: () => 'photo',
  },
  {
    id: 'photo',
    type: 'photo',
    prompt: () => 'Got a photo of them? 📸 It\'s optional — attach one, or type "skip" to use a paw icon instead.',
    next: () => 'dob',
  },
  {
    id: 'dob',
    type: 'date',
    prompt: () => "When's their birthday? 🎂",
    next: () => 'weight',
  },
  {
    id: 'weight',
    type: 'number',
    prompt: () => 'How much do they weigh? ⚖️ (in kg)',
    next: () => 'breed',
  },
  {
    id: 'breed',
    type: 'text',
    prompt: () => "What's their breed? 🧬",
    next: () => 'bloodTypeKnown',
  },
  {
    id: 'bloodTypeKnown',
    type: 'confirm',
    prompt: () => 'Do you know their blood type? 🩸\n✅ Yes\n❌ No',
    next: (answers) => (answers.bloodTypeKnown ? 'bloodTypeValue' : 'vaccinated'),
  },
  {
    id: 'bloodTypeValue',
    type: 'text',
    prompt: () => 'What blood type are they? (e.g. DEA 1.1)',
    next: () => 'vaccinated',
  },
  {
    id: 'vaccinated',
    type: 'confirm',
    prompt: () =>
      'Just a quick health check.\nIs your pet up to date with vaccinations, deworming and preventives?\n✅ Yes\n❌ No',
    next: () => 'healthConditions',
  },
  {
    id: 'healthConditions',
    type: 'confirm',
    prompt: () => 'Does your pet have any major health conditions?\n✅ No\n❌ Yes',
    // NOTE: options here are semantically flipped vs. the label order in the
    // spec ("No" listed first) — `value: true` still means "has a condition".
    optionsOverride: [
      { value: false, label: '✅ No', keywords: ['no', 'n'] },
      { value: true, label: '❌ Yes', keywords: ['yes', 'y'] },
    ],
    next: (answers, conversation) => (answers.healthConditions ? 'healthConditionsNotes' : nextOwnerStep(null)(answers, conversation)),
  },
  {
    id: 'healthConditionsNotes',
    type: 'text',
    prompt: () => 'Please briefly describe the condition(s), so we can pass this on to a potential match.',
    next: nextOwnerStep(null),
  },
  {
    id: 'parentName',
    type: 'text',
    section: 'petParent',
    prompt: () => "Now, tell us about their favourite human.\nWhat's your name?",
    next: nextOwnerStep('parentName'),
  },
  {
    id: 'parentPhone',
    type: 'phone',
    section: 'petParent',
    prompt: () => 'Phone number, with country code (e.g. +91 98765 43210)? 📞',
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
    next: nextOwnerStep('parentPhone'),
  },
  {
    id: 'parentEmail',
    type: 'email',
    section: 'petParent',
    prompt: () => 'Email ID?',
    next: () => 'parentEmailOtp',
  },
  {
    id: 'parentEmailOtp',
    type: 'otp',
    field: 'email',
    sourceStepId: 'parentEmail',
    section: 'petParent',
    onEnter: async (answers, conversation) => {
      const target = answers.parentEmail;
      const { devCode } = await otpService.issueChallenge({
        channel: conversation.channel,
        externalUserId: conversation.externalUserId,
        field: 'email',
        target,
      });
      const hint = devCode ? ` 🧪 Dev mode — your code is ${devCode}` : '';
      return `We just emailed a 6-digit code to ${maskEmail(target)}.${hint}`;
    },
    prompt: () => 'Enter the code below, or type "resend" if it doesn\'t arrive.',
    next: nextOwnerStep('parentEmail'),
  },
  {
    id: 'locationChoice',
    type: 'choice',
    section: 'petParent',
    options: [
      { value: 'saved', label: '📍 Saved location', keywords: ['saved', 'stored', 'current', 'same'] },
      { value: 'new', label: '🗺️ New location', keywords: ['new', 'different', 'other', 'moved'] },
    ],
    prompt: (answers) =>
      `Last one — where do you and ${answers.name || 'your pet'} live?\n` +
      `📍 Saved location — ${answers.savedLocation?.text || 'the one on your profile'}\n` +
      '🗺️ New location — this becomes the location on your profile too',
    next: nextOwnerStep('locationChoice'),
  },
  {
    id: 'parentLocation',
    type: 'location',
    section: 'petParent',
    requireCoordinates: true,
    prompt: () => 'Where do you and your pet live? 📍\nShare your location, or pick your city from the list.',
    next: () => null, // end of flow
  },
];

module.exports = {
  id: 'registerDonor',
  openingMessage: "Here's to pets helping pets\nLet's add yours to the Bloodhound pack. 🐾",
  steps,
  firstStepId: 'species',
};
