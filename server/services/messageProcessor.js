const Conversation = require('../models/Conversation');
const PetParent = require('../models/PetParent');
const Pet = require('../models/Pet');
const flowEngine = require('../engine/flowEngine');
const stepTypes = require('../engine/stepTypes');
const { detectGlobalCommand } = require('../engine/globalCommands');
const accountService = require('../services/accountService');
const matchingService = require('../services/matchingService');
const { defaultSearchRadiusKm } = require('../config/env');

const OPENING_MESSAGE =
  'Hey, we’re Bloodhound 🐾\n' +
  'We help you find blood donors for your pets\n' +
  '(Can’t help you find those lost keys though)\n\n' +
  'One quick thing before we begin: by continuing, you agree to our Terms of Use & Privacy Policy.';

const MENU_STEP = {
  id: 'menu',
  type: 'choice',
  options: [
    { value: 'findDonor', label: '🐶 Find a pet blood donor', keywords: ['find', 'donor', 'search', 'need'] },
    { value: 'registerDonor', label: '❤️ Register your pet as a blood donor', keywords: ['register', 'donate', 'sign up'] },
  ],
  prompt: () => 'What would you like to do?\n🐶 Find a pet blood donor\n❤️ Register your pet as a blood donor',
};

const HELP_MESSAGE =
  'You can say:\n' +
  '• "back" — redo the last answer\n' +
  '• "restart" — go back to the main menu\n' +
  '• "cancel" — stop what you’re doing\n' +
  '• "pause" / "resume" — toggle your pet’s donor visibility\n' +
  '• "delete" — remove your donor profile';

async function loadOrCreateConversation(channel, externalUserId) {
  let conversation = await Conversation.findOne({ channel, externalUserId });
  if (!conversation) {
    conversation = new Conversation({ channel, externalUserId, answers: new Map(), history: [] });
  }
  return conversation;
}

function reply(text, options) {
  return { text, ...(options ? { options } : {}) };
}

async function handleGlobalCommand(command, conversation) {
  const { channel, externalUserId } = conversation;

  switch (command) {
    case 'HELP':
      return [reply(HELP_MESSAGE)];

    case 'BACK': {
      const result = await flowEngine.back(conversation);
      return [reply(result.ok ? result.prompt : result.message, result.ok ? result.options : undefined)];
    }

    case 'RESTART': {
      flowEngine.reset(conversation);
      conversation.currentStepId = 'menu';
      return [reply(OPENING_MESSAGE), reply(MENU_STEP.prompt(), MENU_STEP.options)];
    }

    case 'CANCEL': {
      flowEngine.reset(conversation);
      conversation.currentStepId = null;
      return [reply('Okay, cancelled. Send anything to start over. 🐾')];
    }

    case 'PAUSE': {
      const result = await accountService.pauseAccount(channel, externalUserId);
      return [
        reply(
          result.ok
            ? "Done — your pet's donor profile is paused and hidden from search. Send \"resume\" any time to turn it back on."
            : "We couldn't find a donor profile for you yet."
        ),
      ];
    }

    case 'RESUME': {
      const result = await accountService.resumeAccount(channel, externalUserId);
      return [
        reply(
          result.ok
            ? 'Welcome back! Your donor profile is active again. 🐾'
            : "We couldn't find a donor profile for you yet."
        ),
      ];
    }

    case 'DELETE': {
      const result = await accountService.deleteAccount(channel, externalUserId);
      return [
        reply(
          result.ok
            ? "Your donor profile has been deleted and won't show up in searches. Sorry to see you go. 🐾"
            : "We couldn't find a donor profile for you yet."
        ),
      ];
    }

    default:
      return [reply("Sorry, I didn't catch that.")];
  }
}

function formatDonorResults(donors, locationLabel) {
  if (donors.length === 0) {
    return `No donors found near ${locationLabel} yet. We'll keep sniffing — try a wider area or check back soon.`;
  }
  const header = `Available donors near ${locationLabel}:`;
  const lines = donors.map((d) => {
    const parts = [
      d.name,
      d.species === 'dog' ? '🐶' : '🐱',
      d.breed ? d.breed : null,
      d.ageYears != null ? `🎂 ${d.ageYears} years` : null,
      `🩸 ${d.bloodType}`,
      d.weightKg ? `⚖️ ${d.weightKg} kg` : null,
      d.locationText ? `📍 ${d.locationText}` : null,
    ].filter(Boolean);
    const ownerLine = `👤 Hooman - ${d.ownerName || 'Unknown'}  📞 ${d.ownerPhone || 'N/A'}`;
    return `${parts.join('  ')}\n${ownerLine}`;
  });
  return [header, ...lines].join('\n\n');
}

async function persistRegisteredDonor(conversation, answers) {
  const { channel, externalUserId } = conversation;
  const locationAnswer = answers.parentLocation;
  const isGeoPoint = locationAnswer?.type === 'Point';

  const parentUpdate = {
    name: answers.parentName,
    phone: answers.parentPhone,
    email: answers.parentEmail,
    channel,
    externalUserId,
    consentAcceptedAt: conversation.consentAcceptedAt,
    location: isGeoPoint ? { type: 'Point', coordinates: locationAnswer.coordinates } : undefined,
    locationText: isGeoPoint ? locationAnswer.text || null : locationAnswer.text,
    phoneVerifiedAt: answers.parentPhoneOtp || null,
    emailVerifiedAt: answers.parentEmailOtp || null,
    deletedAt: null,
  };

  const parent = await PetParent.findOneAndUpdate(
    { channel, externalUserId },
    { $set: parentUpdate },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const pet = await Pet.create({
    owner: parent._id,
    species: answers.species,
    sex: answers.sex,
    name: answers.name,
    dob: answers.dob,
    weightKg: answers.weight,
    breed: answers.breed,
    bloodType: { known: !!answers.bloodTypeKnown, value: answers.bloodTypeValue || null },
    vaccinated: !!answers.vaccinated,
    healthConditions: { has: !!answers.healthConditions, notes: answers.healthConditions ? answers.healthConditionsNotes || null : null },
    location: parent.location,
    locationText: parent.locationText,
    donorStatus: 'active',
  });

  conversation.petParent = parent._id;
  return { parent, pet };
}

async function runDonorSearch(answers) {
  const locationAnswer = answers.location;
  const isGeoPoint = locationAnswer?.type === 'Point';
  const donors = await matchingService.searchDonors({
    species: answers.species,
    point: isGeoPoint ? { coordinates: locationAnswer.coordinates } : null,
    locationText: isGeoPoint ? null : locationAnswer.text,
    radiusKm: defaultSearchRadiusKm,
  });
  const locationLabel = isGeoPoint ? locationAnswer.text || 'your location' : locationAnswer.text;
  return formatDonorResults(donors, locationLabel);
}

/**
 * Main entry point. `normalized` is the channel-agnostic message shape
 * produced by a ChannelAdapter's normalizeIncoming(). Returns an array of
 * reply messages ({ text, options? }) to send back, in order.
 */
async function handle(normalized) {
  const { channel, externalUserId, text, payload, location, messageId } = normalized;
  const conversation = await loadOrCreateConversation(channel, externalUserId);

  if (messageId && conversation.lastMessageId === messageId) {
    return []; // duplicate webhook delivery
  }
  if (messageId) conversation.lastMessageId = messageId;

  const input = { text, payload, location };
  const command = detectGlobalCommand(text);

  let replies;

  if (command) {
    replies = await handleGlobalCommand(command, conversation);
  } else if (conversation.flow) {
    const result = await flowEngine.advance(conversation, input);
    if (result.error) {
      replies = [reply(`${result.error}\n\n${result.prompt}`, result.options)];
    } else if (result.done) {
      if (result.flow === 'registerDonor') {
        await persistRegisteredDonor(conversation, result.answers);
        replies = [
          reply(
            "Welcome to the pack. 🐾\nYour pet is now listed as a Bloodhound donor.\nIf they're a match for a pet in need, their human will be able to contact you directly.\nThank you for being part of a community that shows up for each other."
          ),
        ];
      } else if (result.flow === 'findDonor') {
        const resultsText = await runDonorSearch(result.answers);
        replies = [reply(resultsText)];
      }
      flowEngine.reset(conversation);
      conversation.currentStepId = null;
    } else {
      replies = [reply(result.prompt, result.options)];
    }
  } else if (conversation.currentStepId !== 'menu') {
    // First contact (or returning after a completed/reset flow): greet + show menu.
    conversation.currentStepId = 'menu';
    replies = [reply(OPENING_MESSAGE), reply(MENU_STEP.prompt(), MENU_STEP.options)];
  } else {
    // We already showed the menu; this input should be the find/register choice.
    const result = stepTypes.validators.choice(input, MENU_STEP);
    if (!result.valid) {
      replies = [reply(`${result.error}\n\n${MENU_STEP.prompt()}`, MENU_STEP.options)];
    } else {
      conversation.consentAcceptedAt = conversation.consentAcceptedAt || new Date();
      const started = await flowEngine.start(conversation, result.value);
      replies = [reply(started.prompt, started.options)];
    }
  }

  await conversation.save();
  return replies;
}

module.exports = { handle, OPENING_MESSAGE, MENU_STEP };
