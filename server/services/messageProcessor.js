const Conversation = require('../models/Conversation');
const PetParent = require('../models/PetParent');
const Pet = require('../models/Pet');
const flowEngine = require('../engine/flowEngine');
const stepTypes = require('../engine/stepTypes');
const { detectGlobalCommand } = require('../engine/globalCommands');
const accountService = require('../services/accountService');
const matchingService = require('../services/matchingService');
const { storeDocument } = require('../services/documentStorageService');
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
    { value: 'uploadRecords', label: '📎 Upload medical records', keywords: ['upload', 'record', 'file', 'document', 'medical'] },
  ],
  prompt: () =>
    'What would you like to do?\n🐶 Find a pet blood donor\n❤️ Register your pet as a blood donor\n📎 Upload medical records',
};

const UPLOAD_CONFIRM_OPTIONS = [
  { value: true, label: 'Yes please' },
  { value: false, label: 'Not now' },
];

const ACCEPTED_UPLOAD_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
];

const HELP_MESSAGE =
  'You can say:\n' +
  '• "back" — redo the last answer\n' +
  '• "restart" — go back to the main menu\n' +
  '• "cancel" — stop what you’re doing\n' +
  '• "pause" / "resume" — toggle your pet’s donor visibility (pick which pet, if you have more than one)\n' +
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
      conversation.pendingAction = null;
      conversation.pendingPetIds = [];
      return [reply('Okay, cancelled. Send anything to start over. 🐾')];
    }

    case 'PAUSE': {
      const parent = await accountService.findParent(channel, externalUserId);
      if (!parent) {
        return [reply("We couldn't find a donor profile for you yet.")];
      }
      const pets = await Pet.find({ owner: parent._id, donorStatus: { $ne: 'deleted' } }).sort({ createdAt: 1 });
      if (pets.length === 0) {
        return [reply("We couldn't find a donor profile for you yet.")];
      }
      if (pets.length === 1) {
        await Pet.updateOne({ _id: pets[0]._id }, { donorStatus: 'paused' });
        return [
          reply(
            `Done — ${pets[0].name || 'your pet'}'s donor profile is paused and hidden from search. Send "resume" any time to turn it back on.`
          ),
        ];
      }
      conversation.pendingAction = 'pauseSelect';
      conversation.pendingPetIds = pets.map((p) => p._id);
      const petList = pets
        .map((p, i) => `${i + 1}. ${p.name || 'Unnamed'} ${p.species === 'dog' ? '🐶' : '🐱'} — currently ${p.donorStatus}`)
        .join('\n');
      return [
        reply(
          `You've got a few pets registered. Which ones should we pause?\n${petList}\n\nReply with numbers (e.g. "1,3"), or "all". Type "cancel" to back out.`
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
    photoUrl: answers.photo || null,
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

/** Resolves a reply to the "which pets should we pause?" prompt set by the PAUSE global command. */
async function resolvePauseSelection(conversation, text) {
  const raw = (text || '').trim().toLowerCase();
  const petIds = conversation.pendingPetIds || [];

  if (raw === 'cancel' || raw === 'stop' || raw === 'exit') {
    conversation.pendingAction = null;
    conversation.pendingPetIds = [];
    return [reply('Okay, cancelled.')];
  }

  const pets = await Pet.find({ _id: { $in: petIds } });
  let selected;
  if (raw === 'all') {
    selected = pets;
  } else {
    const indices = raw.split(',').map((s) => parseInt(s.trim(), 10));
    selected = indices
      .filter((i) => Number.isInteger(i) && i >= 1 && i <= petIds.length)
      .map((i) => pets.find((p) => String(p._id) === String(petIds[i - 1])))
      .filter(Boolean);
  }

  if (selected.length === 0) {
    return [reply('Please reply with numbers from the list (e.g. "1,3"), or "all". Type "cancel" to back out.')];
  }

  await Pet.updateMany({ _id: { $in: selected.map((p) => p._id) } }, { donorStatus: 'paused' });
  conversation.pendingAction = null;
  conversation.pendingPetIds = [];
  const names = selected.map((p) => p.name || 'Unnamed').join(', ');
  return [reply(`Done — paused: ${names}. Send "resume" any time to turn them back on.`)];
}

/** Kicks off the "upload medical records" flow from the main menu, branching on how many pets the owner has. */
async function startUploadRecords(conversation) {
  const { channel, externalUserId } = conversation;
  conversation.currentStepId = null;

  const parent = await accountService.findParent(channel, externalUserId);
  if (!parent) {
    return [reply("We couldn't find a donor profile for you yet. Register your pet first, then come back to add medical records.")];
  }

  const pets = await Pet.find({ owner: parent._id, donorStatus: { $ne: 'deleted' } }).sort({ createdAt: 1 });
  if (pets.length === 0) {
    return [reply("We couldn't find a pet on your profile yet. Register your pet first, then come back to add medical records.")];
  }

  if (pets.length === 1) {
    conversation.pendingAction = 'uploadRecordsConfirm';
    conversation.pendingPetIds = [pets[0]._id];
    return [
      reply(
        `I can add files to ${pets[0].name || 'your pet'}'s medical records.\nWant me to go ahead?`,
        UPLOAD_CONFIRM_OPTIONS
      ),
    ];
  }

  conversation.pendingAction = 'uploadRecordsSelect';
  conversation.pendingPetIds = pets.map((p) => p._id);
  const petList = pets.map((p, i) => `${i + 1}. ${p.name || 'Unnamed'} ${p.species === 'dog' ? '🐶' : '🐱'}`).join('\n');
  return [reply(`Which pet are these files for?\n${petList}\n\nReply with a number. Type "cancel" to back out.`)];
}

/** Resolves a reply to the "which pet are these files for?" prompt set by startUploadRecords. */
async function resolveUploadPetSelection(conversation, text) {
  const raw = (text || '').trim().toLowerCase();
  const petIds = conversation.pendingPetIds || [];

  if (raw === 'cancel' || raw === 'stop' || raw === 'exit') {
    conversation.pendingAction = null;
    conversation.pendingPetIds = [];
    return [reply('Okay, cancelled.')];
  }

  const index = parseInt(raw, 10);
  const petId = Number.isInteger(index) && index >= 1 && index <= petIds.length ? petIds[index - 1] : null;
  if (!petId) {
    return [reply('Please reply with a number from the list, or "cancel" to back out.')];
  }

  const pet = await Pet.findById(petId);
  conversation.pendingAction = 'uploadRecordsConfirm';
  conversation.pendingPetIds = [petId];
  return [
    reply(`Got it — ${pet?.name || 'that pet'}. Want me to add files to their medical records?`, UPLOAD_CONFIRM_OPTIONS),
  ];
}

/** Resolves the "want me to go ahead?" confirm set by startUploadRecords / resolveUploadPetSelection. */
async function resolveUploadConfirm(conversation, input) {
  const result = stepTypes.validators.confirm(input, {});
  if (!result.valid) {
    return [reply('Want me to add files to their medical records?', UPLOAD_CONFIRM_OPTIONS)];
  }
  if (!result.value) {
    conversation.pendingAction = null;
    conversation.pendingPetIds = [];
    return [reply('No problem — send "upload medical records" any time.')];
  }
  conversation.pendingAction = 'uploadRecordsFile';
  return [reply('Great — attach a file (PDF, DOCX, JPG or PNG). Send as many as you like, then type "done".')];
}

/** Handles each incoming attachment while `pendingAction === 'uploadRecordsFile'`. */
async function resolveUploadFile(conversation, input) {
  const raw = (input.text || '').trim().toLowerCase();

  if (raw === 'done' || raw === 'finish' || raw === 'stop') {
    conversation.pendingAction = null;
    conversation.pendingPetIds = [];
    return [reply('All set — those files are now on their profile. 🐾')];
  }
  if (raw === 'cancel') {
    conversation.pendingAction = null;
    conversation.pendingPetIds = [];
    return [reply('Okay, cancelled.')];
  }

  const attachment = input.attachment;
  if (!attachment || !attachment.dataUrl || !ACCEPTED_UPLOAD_TYPES.includes(attachment.mimeType)) {
    return [reply('Please attach a file (PDF, DOCX, JPG or PNG), or type "done" when finished.')];
  }

  const petId = (conversation.pendingPetIds || [])[0];
  if (!petId) {
    conversation.pendingAction = null;
    return [reply('Something went wrong — let\'s start over. Send "upload medical records" to try again.')];
  }

  const filename = attachment.filename || 'Uploaded file';
  const stored = await storeDocument({ petId, filename, mimeType: attachment.mimeType, dataUrl: attachment.dataUrl });

  await Pet.updateOne(
    { _id: petId },
    {
      $push: {
        documents: {
          filename,
          mimeType: attachment.mimeType,
          url: stored.url,
          sizeBytes: attachment.sizeBytes,
          status: 'pending',
        },
      },
    }
  );
  return [reply(`Added ${filename}. ✅ Attach another file, or type "done" when finished.`)];
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
  const { channel, externalUserId, text, payload, location, attachment, messageId } = normalized;
  const conversation = await loadOrCreateConversation(channel, externalUserId);

  if (messageId && conversation.lastMessageId === messageId) {
    return []; // duplicate webhook delivery
  }
  if (messageId) conversation.lastMessageId = messageId;

  const input = { text, payload, location, attachment };
  const command = detectGlobalCommand(text);

  let replies;

  if (conversation.pendingAction === 'pauseSelect' && command !== 'CANCEL') {
    replies = await resolvePauseSelection(conversation, text);
  } else if (conversation.pendingAction === 'uploadRecordsSelect' && command !== 'CANCEL') {
    replies = await resolveUploadPetSelection(conversation, text);
  } else if (conversation.pendingAction === 'uploadRecordsConfirm' && command !== 'CANCEL') {
    replies = await resolveUploadConfirm(conversation, input);
  } else if (conversation.pendingAction === 'uploadRecordsFile' && command !== 'CANCEL') {
    replies = await resolveUploadFile(conversation, input);
  } else if (command) {
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
    } else if (result.value === 'uploadRecords') {
      replies = await startUploadRecords(conversation);
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
