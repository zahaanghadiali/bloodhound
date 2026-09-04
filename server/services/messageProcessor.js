const Conversation = require('../models/Conversation');
const PetParent = require('../models/PetParent');
const Pet = require('../models/Pet');
const flowEngine = require('../engine/flowEngine');
const stepTypes = require('../engine/stepTypes');
const { detectGlobalCommand } = require('../engine/globalCommands');
const accountService = require('../services/accountService');
const matchingService = require('../services/matchingService');
const otpService = require('../services/otpService');
const { storeDocument } = require('../services/documentStorageService');
const { maskPhone } = require('../utils/mask');
const { defaultSearchRadiusKm, records: recordsConfig } = require('../config/env');

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
    { value: 'uploadRecords', label: '📎 Upload medical records', keywords: ['upload', 'add file', 'add document'] },
    { value: 'viewRecords', label: '📂 View medical records', keywords: ['view', 'see', 'show', 'list', 'record', 'file', 'document', 'medical'] },
  ],
  prompt: () =>
    'What would you like to do?\n🐶 Find a pet blood donor\n❤️ Register your pet as a blood donor\n📎 Upload medical records\n📂 View medical records',
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
      conversation.pendingPhone = null;
      conversation.pendingPurpose = null;
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

/**
 * Every anonymous chat session that ever ran registerDonor created its own
 * PetParent (unique per {channel, externalUserId}), so the same real owner
 * registering from two devices/sessions ends up with two separate
 * PetParent docs sharing one phone number. These flows need every pet
 * across all of them, so lookups here always return an array, never a
 * single doc.
 */
async function findParentsByPhone(phone) {
  return PetParent.find({ phone, deletedAt: null });
}

/** Matches a WhatsApp webhook's `from` number (digits only, no "+") against however a registered PetParent.phone happens to be formatted. */
async function findParentsByWhatsAppNumber(externalUserId) {
  const digits = String(externalUserId || '').replace(/\D/g, '');
  if (!digits) return [];
  return PetParent.find({ deletedAt: null, phone: { $in: [digits, `+${digits}`] } });
}

/** True if this device/session already OTP-verified a phone number for the records flows within RECORDS_VERIFICATION_TTL_DAYS. */
function hasFreshRecordsVerification(conversation) {
  if (!conversation.verifiedPhone || !conversation.phoneVerifiedForRecordsAt) return false;
  const ttlMs = recordsConfig.phoneVerificationTtlDays * 24 * 60 * 60 * 1000;
  return Date.now() - conversation.phoneVerifiedForRecordsAt.getTime() < ttlMs;
}

/**
 * Kicks off the "upload/view medical records" flow from the main menu.
 * Pets can be registered from a different session/device than the one
 * asking to see them, so rather than trusting the current session's own
 * donor profile (accountService.findParent), these two flows re-identify
 * the owner by their registered phone number.
 *
 * On WhatsApp, the channel itself already proves the sender's phone
 * number (externalUserId *is* the verified `from` number on every
 * message) — no OTP needed there, ever. On the website demo and
 * Instagram, where anyone could type any phone number, an OTP is
 * required the same way registerDonor already verifies phone numbers —
 * but only once per device/session per RECORDS_VERIFICATION_TTL_DAYS;
 * a still-fresh verification skips straight to picking a pet.
 */
async function startRecordsFlow(conversation, purpose) {
  conversation.currentStepId = null;

  if (conversation.channel === 'whatsapp') {
    const parents = await findParentsByWhatsAppNumber(conversation.externalUserId);
    if (parents.length === 0) {
      return [reply("We couldn't find a donor profile linked to this WhatsApp number. Register your pet first, then come back.")];
    }
    return startPetSelection(conversation, parents, purpose);
  }

  if (hasFreshRecordsVerification(conversation)) {
    const parents = await findParentsByPhone(conversation.verifiedPhone);
    if (parents.length > 0) {
      return startPetSelection(conversation, parents, purpose);
    }
    // The verified phone no longer matches any profile (e.g. it was
    // changed or deleted) — fall through and ask again below.
  }

  conversation.pendingAction = 'recordsPhone';
  conversation.pendingPurpose = purpose;
  conversation.pendingPetIds = [];
  return [reply("What's the phone number on your Bloodhound profile? 📞")];
}

/** Resolves the phone number entered for startRecordsFlow — looks up the owner and, if found, sends an OTP to confirm it's really them. */
async function resolveRecordsPhone(conversation, input) {
  const result = stepTypes.validators.phone(input);
  if (!result.valid) {
    return [reply(`${result.error}\n\nWhat's the phone number on your Bloodhound profile? 📞`)];
  }

  const parents = await findParentsByPhone(result.value);
  if (parents.length === 0) {
    conversation.pendingAction = null;
    conversation.pendingPurpose = null;
    return [reply("We couldn't find a donor profile with that phone number. Register your pet first, then come back.")];
  }

  conversation.pendingPhone = result.value;
  conversation.pendingAction = 'recordsOtp';
  const { channel, externalUserId } = conversation;
  const { devCode } = await otpService.issueChallenge({ channel, externalUserId, field: 'phone', target: result.value });
  const hint = devCode ? ` 🧪 Dev mode — your code is ${devCode}` : '';
  return [
    reply(
      `We just texted a 6-digit code to ${maskPhone(result.value)}.${hint}\n\nEnter the code below, or type "resend" if it doesn't arrive.`
    ),
  ];
}

/** Resolves the OTP entered for resolveRecordsPhone — on success, moves on to picking which pet. */
async function resolveRecordsOtp(conversation, input) {
  const { channel, externalUserId } = conversation;
  const raw = (input.text || '').trim().toLowerCase();

  if (raw === 'resend' || raw === 'resend code') {
    const result = await otpService.resend({ channel, externalUserId, field: 'phone', target: conversation.pendingPhone });
    if (!result.ok) return [reply(result.error)];
    const hint = result.devCode ? ` 🧪 Dev mode — your code is ${result.devCode}` : '';
    return [reply(`Sent a new code to ${maskPhone(conversation.pendingPhone)}.${hint}`)];
  }

  const code = (input.text || '').trim().replace(/\s/g, '');
  if (!/^\d{4,8}$/.test(code)) {
    return [reply('Please enter the numeric code we sent you, or type "resend".')];
  }

  const result = await otpService.verifyCode({ channel, externalUserId, field: 'phone', code });
  if (!result.ok) {
    return [reply(`${result.error}\n\nEnter the code below, or type "resend" if it doesn't arrive.`)];
  }

  const parents = await findParentsByPhone(conversation.pendingPhone);
  const purpose = conversation.pendingPurpose;
  const verifiedPhone = conversation.pendingPhone;
  conversation.pendingPhone = null;

  if (parents.length === 0) {
    conversation.pendingAction = null;
    conversation.pendingPurpose = null;
    return [reply("That profile isn't there anymore — please try again.")];
  }

  // Remembered on the conversation so this device/session isn't asked
  // again for RECORDS_VERIFICATION_TTL_DAYS (see hasFreshRecordsVerification).
  conversation.verifiedPhone = verifiedPhone;
  conversation.phoneVerifiedForRecordsAt = new Date();

  return startPetSelection(conversation, parents, purpose);
}

/** Once the owner is phone-verified, branches on how many pets they have across every PetParent that shares their phone. Shared by both the upload and view flows. */
async function startPetSelection(conversation, parents, purpose) {
  const pets = await Pet.find({ owner: { $in: parents.map((p) => p._id) }, donorStatus: { $ne: 'deleted' } }).sort({ createdAt: 1 });
  if (pets.length === 0) {
    conversation.pendingAction = null;
    conversation.pendingPurpose = null;
    return [reply("We couldn't find a pet on that profile yet.")];
  }

  if (pets.length === 1) {
    return purpose === 'upload' ? beginUpload(conversation, pets[0]) : finishView(conversation, pets[0]);
  }

  conversation.pendingAction = purpose === 'upload' ? 'uploadRecordsSelect' : 'viewRecordsSelect';
  conversation.pendingPetIds = pets.map((p) => p._id);
  conversation.pendingPurpose = null;
  const petList = pets.map((p, i) => `${i + 1}. ${p.name || 'Unnamed'} ${p.species === 'dog' ? '🐶' : '🐱'}`).join('\n');
  const verb = purpose === 'upload' ? 'are these files for' : 'would you like to see';
  return [reply(`Which pet ${verb}?\n${petList}\n\nReply with a number. Type "cancel" to back out.`)];
}

function beginUpload(conversation, pet) {
  conversation.pendingAction = 'uploadRecordsConfirm';
  conversation.pendingPetIds = [pet._id];
  conversation.pendingPurpose = null;
  return [
    reply(`I can add files to ${pet.name || 'your pet'}'s medical records.\nWant me to go ahead?`, UPLOAD_CONFIRM_OPTIONS),
  ];
}

function finishView(conversation, pet) {
  conversation.pendingAction = null;
  conversation.pendingPurpose = null;
  return [reply(formatDocumentsList(pet))];
}

/** Resolves a reply to the "which pet are these files for?" prompt set by startPetSelection (upload branch). */
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
  if (!pet) {
    conversation.pendingAction = null;
    conversation.pendingPetIds = [];
    return [reply("Couldn't find that pet.")];
  }
  return beginUpload(conversation, pet);
}

/** Resolves the "want me to go ahead?" confirm set by beginUpload / resolveUploadPetSelection. */
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
  const stored = await storeDocument({ petId, category: 'documents', filename, mimeType: attachment.mimeType, dataUrl: attachment.dataUrl });

  await Pet.updateOne(
    { _id: petId },
    {
      $push: {
        documents: {
          filename,
          mimeType: attachment.mimeType,
          storageKey: stored.key || undefined,
          url: stored.url || undefined,
          sizeBytes: attachment.sizeBytes,
          status: 'pending',
        },
      },
    }
  );
  return [reply(`Added ${filename}. ✅ Attach another file, or type "done" when finished.`)];
}

/** Renders one pet's medical records as a numbered list for the "view medical records" flow. */
function formatDocumentsList(pet) {
  const docs = pet.documents || [];
  const name = pet.name || 'This pet';
  if (docs.length === 0) {
    return `${name} has no medical records on file yet. Send "upload medical records" to add some.`;
  }
  const lines = docs.map((d, i) => {
    const statusLabel = d.status === 'verified' ? '✅ Verified' : '🕓 Pending review';
    const date = d.uploadedAt ? new Date(d.uploadedAt).toLocaleDateString() : null;
    return `${i + 1}. ${d.filename} — ${statusLabel}${date ? ` · ${date}` : ''}`;
  });
  return [`${name}'s medical records (${docs.length}):`, ...lines].join('\n');
}

/** Resolves a reply to the "which pet would you like to see?" prompt set by startPetSelection (view branch). */
async function resolveViewPetSelection(conversation, text) {
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
  if (!pet) {
    conversation.pendingAction = null;
    conversation.pendingPetIds = [];
    return [reply("Couldn't find that pet.")];
  }
  return finishView(conversation, pet);
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
  } else if (conversation.pendingAction === 'recordsPhone' && command !== 'CANCEL') {
    replies = await resolveRecordsPhone(conversation, input);
  } else if (conversation.pendingAction === 'recordsOtp' && command !== 'CANCEL') {
    replies = await resolveRecordsOtp(conversation, input);
  } else if (conversation.pendingAction === 'uploadRecordsSelect' && command !== 'CANCEL') {
    replies = await resolveUploadPetSelection(conversation, text);
  } else if (conversation.pendingAction === 'uploadRecordsConfirm' && command !== 'CANCEL') {
    replies = await resolveUploadConfirm(conversation, input);
  } else if (conversation.pendingAction === 'uploadRecordsFile' && command !== 'CANCEL') {
    replies = await resolveUploadFile(conversation, input);
  } else if (conversation.pendingAction === 'viewRecordsSelect' && command !== 'CANCEL') {
    replies = await resolveViewPetSelection(conversation, text);
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
      replies = await startRecordsFlow(conversation, 'upload');
    } else if (result.value === 'viewRecords') {
      replies = await startRecordsFlow(conversation, 'view');
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
