const mongoose = require('mongoose');
const Conversation = require('../models/Conversation');
const PetParent = require('../models/PetParent');
const Pet = require('../models/Pet');
const PetDocument = require('../models/PetDocument');
const DonorRequest = require('../models/DonorRequest');
const flowEngine = require('../engine/flowEngine');
const stepTypes = require('../engine/stepTypes');
const { detectGlobalCommand } = require('../engine/globalCommands');
const accountService = require('../services/accountService');
const identityService = require('../services/identityService');
const donorRequestService = require('../services/donorRequestService');
const otpService = require('../services/otpService');
const { storeDocument, storePetPhoto, resolveDocumentUrl, listPetDocuments } = require('../services/documentStorageService');
const { maskPhone } = require('../utils/mask');
const { records: recordsConfig, trustWebSessionPhone } = require('../config/env');

const OPENING_MESSAGE =
  'Hey, we’re Bloodhound 🐾\n' +
  'We help you find blood donors for your pets\n' +
  '(Can’t help you find those lost keys though)\n\n' +
  'One quick thing before we begin: by continuing, you agree to our Terms of Use & Privacy Policy.';

const MENU_STEP = {
  id: 'menu',
  type: 'choice',
  options: [
    { value: 'findDonor', label: '🐶 Find a pet blood donor', shortLabel: '🐶 Find a donor', keywords: ['find', 'donor', 'search', 'need'] },
    { value: 'registerDonor', label: '❤️ Register your pet as a blood donor', shortLabel: '❤️ Register as donor', keywords: ['register', 'donate', 'sign up'] },
    { value: 'uploadRecords', label: '📎 Upload medical records', shortLabel: '📎 Upload records', keywords: ['upload', 'add file', 'add document'] },
    { value: 'viewRecords', label: '📂 View medical records', keywords: ['view', 'see', 'show', 'list', 'record', 'file', 'document', 'medical'] },
    { value: 'mySearches', label: '🔍 My searches', keywords: ['my searches', 'my search', 'search status'] },
    { value: 'myRequests', label: '📨 My requests', keywords: ['my requests', 'view requests'] },
  ],
  prompt: () =>
    'What would you like to do?\n🐶 Find a pet blood donor\n❤️ Register your pet as a blood donor\n📎 Upload medical records\n📂 View medical records\n🔍 My searches\n📨 My requests',
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
  '• "delete" — remove your donor profile\n' +
  '• "stop searching" — end an in-progress donor search\n' +
  '• "my requests" — see donor requests you\'ve been asked about\n' +
  '• "my searches" — check the status of searches you\'ve started';

/**
 * Gets the conversation for a channel identity, creating it atomically with an
 * upsert so two simultaneous first messages cannot both insert one.
 * @param {string} channel Channel name.
 * @param {string} externalUserId Channel-specific user id.
 * @return {Promise<Object>} The Conversation document.
 */
async function loadOrCreateConversation(channel, externalUserId) {
  return Conversation.findOneAndUpdate(
    { channel, externalUserId },
    { $setOnInsert: { channel, externalUserId, answers: new Map(), history: [] } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

/**
 * Builds one outbound reply message.
 * @param {string} text Message text.
 * @param {?Array<Object>=} options Quick-reply options to offer.
 * @param {Object=} extras Extra fields to merge in, such as listButton,
 *     optionsStyle or media.
 * @return {Object} The reply message.
 */
function reply(text, options, extras) {
  return { text, ...(options ? { options } : {}), ...extras };
}

/**
 * Converts a flow engine result into a reply.
 * @param {{prompt: string, options: ?Array<Object>, listButton:
 *     (string|undefined)}} result Result of flowEngine.start, advance or back.
 * @param {string=} error Validation error to show above the prompt.
 * @return {Object} The reply message.
 */
function flowReply(result, error) {
  const text = error ? `${error}\n\n${result.prompt}` : result.prompt;
  return reply(text, result.options, result.listButton ? { listButton: result.listButton } : undefined);
}

/**
 * Runs a command that works at any point in any flow, such as BACK, CANCEL,
 * PAUSE or MY_SEARCHES, mutating the conversation as needed.
 * @param {string} command Key from globalCommands.COMMANDS.
 * @param {Object} conversation Conversation document.
 * @return {Promise<Array<Object>>} Reply messages to send, in order.
 */
async function handleGlobalCommand(command, conversation) {
  const { channel, externalUserId } = conversation;

  switch (command) {
    case 'HELP':
      return [reply(HELP_MESSAGE)];

    case 'BACK': {
      const result = await flowEngine.back(conversation);
      return [result.ok ? flowReply(result) : reply(result.message)];
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
      conversation.pendingDonorAcceptRequestId = null;
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

    case 'STOP_SEARCH': {
      const parent = await accountService.findParent(channel, externalUserId);
      const request = parent && (await donorRequestService.findActiveForSearcher(parent._id));
      if (!request) {
        return [reply("You don't have a donor search running right now.")];
      }
      await donorRequestService.stopRequest(request);
      conversation.pendingUnlimitedConfirmRequestId = null;
      return [reply('Search stopped. Say "find a pet blood donor" any time to start a new one. 🐾')];
    }

    case 'MY_REQUESTS':
      return showRequestsPage(conversation, 0);

    case 'MY_SEARCHES':
      return showSearchesPage(conversation, 0);

    default:
      return [reply("Sorry, I didn't catch that.")];
  }
}

/**
 * Fills in the phone number and its verification on WhatsApp, where the
 * sender's number is proven by the channel and the flows skip their phone and
 * OTP steps.
 * @param {Object} conversation Conversation document.
 * @param {Object} answers Answers from a completed flow.
 * @return {Object} The answers, with parentPhone and parentPhoneOtp added when
 *     on WhatsApp and no phone was collected.
 */
function withChannelVerifiedPhone(conversation, answers) {
  if (conversation.channel !== 'whatsapp' || answers.parentPhone) return answers;
  const digits = String(conversation.externalUserId || '').replace(/\D/g, '');
  return { ...answers, parentPhone: `+${digits}`, parentPhoneOtp: new Date() };
}

/**
 * Saves a completed registerDonor flow: updates the pet parent resolved by
 * phone number, stores the pet's photo and creates the pet.
 * @param {Object} conversation Conversation document; its petParent is set.
 * @param {Object} answers Answers from the completed flow.
 * @return {Promise<{parent: Object, pet: Object}>} The saved pet parent and
 *     pet.
 * @throws {Error} If the photo cannot be stored or a document fails validation.
 */
async function persistRegisteredDonor(conversation, answers) {
  const { channel, externalUserId } = conversation;
  const locationAnswer = answers.parentLocation;
  const isGeoPoint = locationAnswer?.type === 'Point';

  const parentUpdate = {
    name: answers.parentName,
    phone: answers.parentPhone,
    email: answers.parentEmail,
    consentAcceptedAt: conversation.consentAcceptedAt,
    location: isGeoPoint ? { type: 'Point', coordinates: locationAnswer.coordinates } : undefined,
    address: isGeoPoint ? locationAnswer.address || undefined : undefined,
    locationText: isGeoPoint ? locationAnswer.text || null : locationAnswer.text,
    phoneVerifiedAt: answers.parentPhoneOtp || null,
    emailVerifiedAt: answers.parentEmailOtp || null,
    deletedAt: null,
  };

  const { parent: resolved } = await identityService.resolveParentByPhone({ channel, externalUserId, phone: answers.parentPhone });
  const parent = await PetParent.findByIdAndUpdate(resolved._id, { $set: parentUpdate }, { new: true });

  const petId = new mongoose.Types.ObjectId();
  const photo = answers.photo ? await storePetPhoto(petId, answers.photo) : null;

  const pet = await Pet.create({
    _id: petId,
    owner: parent._id,
    species: answers.species,
    sex: answers.sex,
    name: answers.name,
    photoKey: photo?.key || undefined,
    photoUrl: photo?.url || null,
    dob: answers.dob,
    weightKg: answers.weight,
    breed: answers.breed,
    bloodType: { known: !!answers.bloodTypeKnown, value: answers.bloodTypeValue || null },
    vaccinated: !!answers.vaccinated,
    healthConditions: { has: !!answers.healthConditions, notes: answers.healthConditions ? answers.healthConditionsNotes || null : null },
    location: parent.location,
    address: parent.address,
    locationText: parent.locationText,
    donorStatus: 'active',
  });

  conversation.petParent = parent._id;
  return { parent, pet };
}

/**
 * Handles a reply to the "which pets should we pause?" prompt set by the PAUSE
 * command.
 * @param {Object} conversation Conversation document.
 * @param {?string} text Reply text: list numbers such as "1,3", "all" or
 *     "cancel".
 * @return {Promise<Array<Object>>} Reply messages to send, in order.
 */
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
 * Finds every active pet parent that shares a phone number. One owner can have
 * several records, one per device or session they registered from.
 * @param {string} phone Canonical phone number.
 * @return {Promise<Array<Object>>} Matching PetParent documents.
 */
async function findParentsByPhone(phone) {
  return PetParent.find({ phone, deletedAt: null });
}

/**
 * Finds pet parents whose phone matches a WhatsApp sender number, with or
 * without a leading "+".
 * @param {string} externalUserId WhatsApp `from` number.
 * @return {Promise<Array<Object>>} Matching PetParent documents; empty if the
 *     id has no digits.
 */
async function findParentsByWhatsAppNumber(externalUserId) {
  const digits = String(externalUserId || '').replace(/\D/g, '');
  if (!digits) return [];
  return PetParent.find({ deletedAt: null, phone: { $in: [digits, `+${digits}`] } });
}

/**
 * Checks whether this device or session OTP-verified a phone number for the
 * records flows within RECORDS_VERIFICATION_TTL_DAYS.
 * @param {Object} conversation Conversation document.
 * @return {boolean} True if the verification is still fresh.
 */
function hasFreshRecordsVerification(conversation) {
  if (!conversation.verifiedPhone || !conversation.phoneVerifiedForRecordsAt) return false;
  const ttlMs = recordsConfig.phoneVerificationTtlDays * 24 * 60 * 60 * 1000;
  return Date.now() - conversation.phoneVerifiedForRecordsAt.getTime() < ttlMs;
}

/**
 * Starts the upload or view medical records flow from the main menu. The owner
 * is identified by registered phone number: WhatsApp proves it on every
 * message, while other channels need an OTP once per session until the
 * verification expires.
 * @param {Object} conversation Conversation document.
 * @param {string} purpose 'upload' or 'view'.
 * @return {Promise<Array<Object>>} Reply messages to send, in order.
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
  }

  conversation.pendingAction = 'recordsPhone';
  conversation.pendingPurpose = purpose;
  conversation.pendingPetIds = [];
  return [reply("What's the phone number on your Bloodhound profile (with country code, e.g. +91 98765 43210)? 📞")];
}

/**
 * Handles the phone number entered for the records flows: looks up the owner
 * and, if found, sends an OTP to confirm it is really them.
 * @param {Object} conversation Conversation document.
 * @param {Object} input Normalized incoming message.
 * @return {Promise<Array<Object>>} Reply messages to send, in order.
 * @throws {Error} If the OTP provider fails to deliver the code.
 */
async function resolveRecordsPhone(conversation, input) {
  const result = stepTypes.validators.phone(input);
  if (!result.valid) {
    return [reply(`${result.error}\n\nWhat's the phone number on your Bloodhound profile (with country code, e.g. +91 98765 43210)? 📞`)];
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

/**
 * Handles the OTP entered for the records flows. On success it remembers the
 * verified phone on the conversation and moves on to picking a pet.
 * @param {Object} conversation Conversation document.
 * @param {Object} input Normalized incoming message.
 * @return {Promise<Array<Object>>} Reply messages to send, in order.
 * @throws {Error} If the OTP provider fails to deliver a resent code.
 */
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

  conversation.verifiedPhone = verifiedPhone;
  conversation.phoneVerifiedForRecordsAt = new Date();

  return startPetSelection(conversation, parents, purpose);
}

/**
 * Continues a records flow once the owner is verified, branching on how many
 * pets they have across every pet parent sharing their phone.
 * @param {Object} conversation Conversation document.
 * @param {Array<Object>} parents PetParent documents for the verified owner.
 * @param {string} purpose 'upload' or 'view'.
 * @return {Promise<Array<Object>>} Reply messages to send, in order.
 */
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
  return [petSelectionPrompt(pets, purpose)];
}

const PET_OPTION_PREFIX = 'pet:';
const VIEW_DOC_PREFIX = 'viewDoc:';
const VIEW_DOCS_PAGE_PREFIX = 'viewDocs:';

const MAX_LIST_ROWS = 10;

/**
 * Builds the "which pet?" prompt with one tappable option per pet. Beyond what
 * one list can hold, the pets are also numbered so each stays reachable by
 * typing.
 * @param {Array<Object>} pets Pet documents to choose from.
 * @param {string} purpose 'upload' or 'view'.
 * @param {string=} prefix Text to show above the question.
 * @return {Object} The reply message.
 */
function petSelectionPrompt(pets, purpose, prefix) {
  const verb = purpose === 'upload' ? 'are these files for' : 'would you like to see';
  const options = pets.map((p) => ({
    value: `${PET_OPTION_PREFIX}${p._id}`,
    label: `${p.species === 'dog' ? '🐶' : '🐱'} ${p.name || 'Unnamed'}`,
  }));
  const numbered = pets.length > MAX_LIST_ROWS
    ? `\n${pets.map((p, i) => `${i + 1}. ${p.name || 'Unnamed'}`).join('\n')}\n\nPick one below or reply with a number.`
    : '';
  const text = `${prefix ? `${prefix}\n\n` : ''}Which pet ${verb}?${numbered}\n\nType "cancel" to back out.`;
  return reply(text, options, { listButton: 'View Pets' });
}

/**
 * Resolves a reply to a pet prompt, either a tapped option or a typed list
 * number, to one of the conversation's pendingPetIds.
 * @param {Object} conversation Conversation document.
 * @param {Object} input Normalized incoming message.
 * @return {?Object} The matching pet id, or null.
 */
function matchPendingPetId(conversation, input) {
  const petIds = conversation.pendingPetIds || [];
  if (typeof input.payload === 'string' && input.payload.startsWith(PET_OPTION_PREFIX)) {
    const id = input.payload.slice(PET_OPTION_PREFIX.length);
    return petIds.find((p) => String(p) === id) || null;
  }
  const index = parseInt((input.text || '').trim(), 10);
  return Number.isInteger(index) && index >= 1 && index <= petIds.length ? petIds[index - 1] : null;
}

/**
 * Re-sends the pet prompt after a reply that matched no pet.
 * @param {Object} conversation Conversation document.
 * @param {string} purpose 'upload' or 'view'.
 * @return {Promise<Array<Object>>} Reply messages to send, in order.
 */
async function repromptPetSelection(conversation, purpose) {
  const pets = await Pet.find({ _id: { $in: conversation.pendingPetIds || [] } }).sort({ createdAt: 1 });
  return [petSelectionPrompt(pets, purpose, "Sorry, I didn't catch which pet.")];
}

/**
 * Asks for confirmation before adding files to a pet's medical records.
 * @param {Object} conversation Conversation document.
 * @param {Object} pet Pet document the files are for.
 * @return {Array<Object>} Reply messages to send, in order.
 */
function beginUpload(conversation, pet) {
  conversation.pendingAction = 'uploadRecordsConfirm';
  conversation.pendingPetIds = [pet._id];
  conversation.pendingPurpose = null;
  return [
    reply(`I can add files to ${pet.name || 'your pet'}'s medical records.\nWant me to go ahead?`, UPLOAD_CONFIRM_OPTIONS),
  ];
}

/**
 * Ends the view flow by listing a pet's medical records.
 * @param {Object} conversation Conversation document.
 * @param {Object} pet Pet document to show.
 * @return {Promise<Array<Object>>} Reply messages to send, in order.
 */
async function finishView(conversation, pet) {
  conversation.pendingAction = null;
  conversation.pendingPurpose = null;
  return [await documentsListReply(pet, 0)];
}

/**
 * Handles a reply to the "which pet are these files for?" prompt.
 * @param {Object} conversation Conversation document.
 * @param {Object} input Normalized incoming message.
 * @return {Promise<Array<Object>>} Reply messages to send, in order.
 */
async function resolveUploadPetSelection(conversation, input) {
  const raw = (input.text || '').trim().toLowerCase();

  if (raw === 'cancel' || raw === 'stop' || raw === 'exit') {
    conversation.pendingAction = null;
    conversation.pendingPetIds = [];
    return [reply('Okay, cancelled.')];
  }

  const petId = matchPendingPetId(conversation, input);
  if (!petId) {
    return repromptPetSelection(conversation, 'upload');
  }

  const pet = await Pet.findById(petId);
  if (!pet) {
    conversation.pendingAction = null;
    conversation.pendingPetIds = [];
    return [reply("Couldn't find that pet.")];
  }
  return beginUpload(conversation, pet);
}

/**
 * Handles the yes/no reply to the upload confirmation.
 * @param {Object} conversation Conversation document.
 * @param {Object} input Normalized incoming message.
 * @return {Promise<Array<Object>>} Reply messages to send, in order.
 */
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

/**
 * Handles each message while files are being uploaded: stores an accepted
 * attachment as a pending pet document, or ends on "done" or "cancel".
 * @param {Object} conversation Conversation document.
 * @param {Object} input Normalized incoming message.
 * @return {Promise<Array<Object>>} Reply messages to send, in order.
 * @throws {Error} If the file cannot be stored.
 */
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

  const pet = await Pet.findById(petId).select('owner');
  if (!pet) {
    conversation.pendingAction = null;
    conversation.pendingPetIds = [];
    return [reply("Couldn't find that pet.")];
  }

  const filename = attachment.filename || 'Uploaded file';
  const stored = await storeDocument({ petId, category: 'documents', filename, mimeType: attachment.mimeType, dataUrl: attachment.dataUrl });

  await PetDocument.create({
    pet: pet._id,
    owner: pet.owner,
    filename,
    mimeType: attachment.mimeType,
    storageKey: stored.key || undefined,
    url: stored.url || undefined,
    sizeBytes: attachment.sizeBytes,
    status: 'pending',
  });
  return [reply(`Added ${filename}. ✅ Attach another file, or type "done" when finished.`)];
}

/**
 * Builds a tappable list of a pet's medical records. A list holds 10 rows, so a
 * longer set gives its last row to a "More files" entry for the next page.
 * @param {Object} pet Pet document.
 * @param {number} offset Index of the first record to show.
 * @return {Promise<Object>} The reply message.
 */
async function documentsListReply(pet, offset) {
  const docs = await listPetDocuments(pet._id);
  const name = pet.name || 'This pet';
  if (docs.length === 0) {
    return reply(`${name} has no medical records on file yet. Send "upload medical records" to add some.`);
  }

  const start = offset >= 0 && offset < docs.length ? offset : 0;
  const fitsOnePage = docs.length - start <= MAX_LIST_ROWS;
  const page = docs.slice(start, start + (fitsOnePage ? MAX_LIST_ROWS : MAX_LIST_ROWS - 1));
  const options = page.map((d) => {
    const statusLabel = d.status === 'verified' ? '✅ Verified' : '🕓 Pending review';
    const date = d.uploadedAt ? new Date(d.uploadedAt).toLocaleDateString() : null;
    return {
      value: `${VIEW_DOC_PREFIX}${pet._id}:${d._id}`,
      label: d.filename,
      description: `${statusLabel}${date ? ` · ${date}` : ''}`,
    };
  });

  const next = start + page.length;
  if (next < docs.length) {
    options.push({
      value: `${VIEW_DOCS_PAGE_PREFIX}${pet._id}:${next}`,
      label: '➡️ More files',
      description: `${docs.length - next} more`,
    });
  }

  const range = page.length < docs.length ? ` — showing ${start + 1}–${next}` : '';
  return reply(`${name}'s medical records (${docs.length})${range}.\nPick a file to open it.`, options, {
    optionsStyle: 'list',
    listButton: 'View Files',
  });
}

/**
 * Looks up a pet named in a client-supplied payload, but only if it belongs to
 * whoever this conversation has proven itself to be: the WhatsApp sender's
 * number, or a still-fresh OTP-verified phone elsewhere.
 * @param {Object} conversation Conversation document.
 * @param {string} petId Pet id taken from the payload.
 * @return {Promise<?Object>} The pet, or null if the id is invalid or the pet
 *     is not the caller's.
 */
async function findOwnedPet(conversation, petId) {
  if (!mongoose.isValidObjectId(petId)) return null;

  let parents = [];
  if (conversation.channel === 'whatsapp') {
    parents = await findParentsByWhatsAppNumber(conversation.externalUserId);
  } else if (hasFreshRecordsVerification(conversation)) {
    parents = await findParentsByPhone(conversation.verifiedPhone);
  }
  if (parents.length === 0) return null;

  return Pet.findOne({ _id: petId, owner: { $in: parents.map((p) => p._id) }, donorStatus: { $ne: 'deleted' } });
}

const RECORDS_EXPIRED_MESSAGE = 'That list is out of date — send "view medical records" to see the latest.';

/**
 * Shows another page of a pet's files, from the list's "More files" row.
 * @param {Object} conversation Conversation document.
 * @param {string} payload Payload of the form "viewDocs:{petId}:{offset}".
 * @return {Promise<Array<Object>>} Reply messages to send, in order.
 */
async function showDocumentsPage(conversation, payload) {
  const [petId, offset] = payload.slice(VIEW_DOCS_PAGE_PREFIX.length).split(':');
  const pet = await findOwnedPet(conversation, petId);
  if (!pet) return [reply(RECORDS_EXPIRED_MESSAGE)];
  return [await documentsListReply(pet, parseInt(offset, 10) || 0)];
}

/**
 * Opens one file tapped in the records list by replying with the file itself as
 * media. Stored files get a freshly signed URL each time.
 * @param {Object} conversation Conversation document.
 * @param {string} payload Payload of the form "viewDoc:{petId}:{docId}".
 * @return {Promise<Array<Object>>} Reply messages to send, in order.
 * @throws {Error} If the storage provider fails to sign the URL.
 */
async function openDocument(conversation, payload) {
  const [petId, docId] = payload.slice(VIEW_DOC_PREFIX.length).split(':');
  const pet = await findOwnedPet(conversation, petId);
  const doc = pet && mongoose.isValidObjectId(docId) && (await PetDocument.findOne({ _id: docId, pet: pet._id }));
  if (!doc) return [reply(RECORDS_EXPIRED_MESSAGE)];

  const url = await resolveDocumentUrl(doc);
  const isLink = /^https?:\/\//.test(url || '');
  if (!url || (!isLink && conversation.channel !== 'mock')) {
    return [reply(`${doc.filename} can't be opened in this chat — you can view it from your pet's files on the Bloodhound website.`)];
  }

  return [reply(`📄 ${doc.filename}`, undefined, { media: { url, filename: doc.filename, mimeType: doc.mimeType } })];
}

/**
 * Handles a reply to the "which pet would you like to see?" prompt.
 * @param {Object} conversation Conversation document.
 * @param {Object} input Normalized incoming message.
 * @return {Promise<Array<Object>>} Reply messages to send, in order.
 */
async function resolveViewPetSelection(conversation, input) {
  const raw = (input.text || '').trim().toLowerCase();

  if (raw === 'cancel' || raw === 'stop' || raw === 'exit') {
    conversation.pendingAction = null;
    conversation.pendingPetIds = [];
    return [reply('Okay, cancelled.')];
  }

  const petId = matchPendingPetId(conversation, input);
  if (!petId) {
    return repromptPetSelection(conversation, 'view');
  }

  const pet = await Pet.findById(petId);
  if (!pet) {
    conversation.pendingAction = null;
    conversation.pendingPetIds = [];
    return [reply("Couldn't find that pet.")];
  }
  return finishView(conversation, pet);
}

/**
 * Rebuilds the answer a location step produces from a stored pet or owner, so a
 * saved location can stand in for a newly shared one.
 * @param {?Object} doc Pet or PetParent document.
 * @return {?{type: string, coordinates: Array<number>, address: ?Object, text:
 *     ?string}} The location answer, or null when the document has no
 *     coordinates.
 */
function savedLocationAnswer(doc) {
  if (doc?.location?.coordinates?.length !== 2) return null;
  return {
    type: 'Point',
    coordinates: doc.location.coordinates,
    address: doc.address ? doc.address.toObject() : null,
    text: doc.locationText || null,
  };
}

/**
 * Collects everything a flow can skip asking because the person's profile
 * already has it: name, verified phone and email, the saved location
 * (registerDonor), and registered pets (findDonor).
 * @param {Object} conversation Conversation document.
 * @param {string} flowId 'registerDonor' or 'findDonor'.
 * @return {Promise<{seed: Object, firstStepId: (string|undefined)}>} Options
 *     for flowEngine.start.
 */
async function flowStartOptions(conversation, flowId) {
  const { channel, externalUserId } = conversation;
  const seed = {};

  let parents;
  if (channel === 'whatsapp') {
    parents = await findParentsByWhatsAppNumber(externalUserId);
    seed.parentPhone = `+${String(externalUserId).replace(/\D/g, '')}`;
    seed.parentPhoneOtp = new Date();
  } else {
    const parent = await accountService.findParent(channel, externalUserId);
    parents = parent ? [parent] : [];
    if (trustWebSessionPhone && parent?.phone && parent.phoneVerifiedAt) {
      seed.parentPhone = parent.phone;
      seed.parentPhoneOtp = parent.phoneVerifiedAt;
    }
  }
  if (parents.length === 0) return { seed };

  const ordered = [...parents].sort((a, b) => (b.channel === channel) - (a.channel === channel));
  /**
   * Finds the first pet parent, this channel's own first, that passes a test.
   * @param {function(Object): *} test Predicate applied to each pet parent.
   * @return {Object|undefined} The first matching pet parent, if any.
   */
  const firstWith = (test) => ordered.find(test);

  const named = firstWith((p) => p.name);
  if (named) seed.parentName = named.name;

  if (flowId === 'registerDonor') {
    const withEmail = firstWith((p) => p.email && p.emailVerifiedAt);
    if (withEmail) {
      seed.parentEmail = withEmail.email;
      seed.parentEmailOtp = withEmail.emailVerifiedAt;
    }
    const savedLocation = savedLocationAnswer(firstWith((p) => savedLocationAnswer(p)));
    if (savedLocation) seed.savedLocation = savedLocation;
    return { seed };
  }

  const pets = await Pet.find({ owner: { $in: parents.map((p) => p._id) }, donorStatus: { $ne: 'deleted' } }).sort({ createdAt: 1 });
  if (pets.length === 0) return { seed };

  seed.myPets = pets.map((p) => ({
    id: String(p._id),
    name: p.name || 'Unnamed',
    species: p.species,
    location: savedLocationAnswer(p),
  }));

  if (pets.length > 1) return { seed, firstStepId: 'pet' };
  seed.pet = seed.myPets[0].id;
  return { seed, firstStepId: seed.myPets[0].location ? 'locationChoice' : 'location' };
}

/**
 * Folds registerDonor's "use my saved location" choice back into the plain
 * parentLocation answer its completion expects.
 * @param {Object} answers Answers from the completed flow.
 * @return {Object} The answers, with parentLocation set from the saved location
 *     when that was chosen.
 */
function resolveRegisterDonorAnswers(answers) {
  if (answers.locationChoice !== 'saved' || !answers.savedLocation) return answers;
  return { ...answers, parentLocation: answers.savedLocation };
}

/**
 * Folds a registered-pet pick and "use saved location" back into the plain
 * species and location answers findDonor's completion expects.
 * @param {Object} answers Answers from the completed flow.
 * @return {Object} The answers, with species and location filled from the
 *     chosen pet when one was picked.
 */
function resolveFindDonorAnswers(answers) {
  const pet = (answers.myPets || []).find((p) => p.id === answers.pet);
  if (!pet) return answers;
  return {
    ...answers,
    species: pet.species,
    location: answers.locationChoice === 'saved' && pet.location ? pet.location : answers.location,
  };
}

/**
 * Saves the searcher's own pet parent record from the findDonor flow's name,
 * phone and OTP answers.
 * @param {Object} conversation Conversation document.
 * @param {Object} answers Answers from the completed flow.
 * @return {Promise<Object>} The updated PetParent document.
 */
async function persistSearcherProfile(conversation, answers) {
  const { channel, externalUserId } = conversation;
  const { parent: resolved } = await identityService.resolveParentByPhone({ channel, externalUserId, phone: answers.parentPhone });
  const parent = await PetParent.findByIdAndUpdate(
    resolved._id,
    {
      $set: {
        name: answers.parentName,
        phone: answers.parentPhone,
        phoneVerifiedAt: answers.parentPhoneOtp || null,
        deletedAt: null,
      },
    },
    { new: true }
  );
  return parent;
}

/**
 * Starts a donor search once findDonor completes, unless the searcher already
 * has one running.
 * @param {Object} conversation Conversation document.
 * @param {Object} answers Answers from the completed flow.
 * @return {Promise<string>} Status text to show the searcher.
 * @throws {Error} If the request cannot be saved or a notification fails.
 */
async function startDonorRequest(conversation, answers) {
  const parent = await persistSearcherProfile(conversation, answers);

  const existing = await donorRequestService.findActiveForSearcher(parent._id);
  if (existing) {
    return 'You already have a search in progress. Say "stop searching" to cancel it before starting a new one.';
  }

  const locationAnswer = answers.location;
  if (locationAnswer.type === 'Point') {
    return donorRequestService.createRequest({
      searcherParentId: parent._id,
      species: answers.species,
      point: { coordinates: locationAnswer.coordinates },
      locationText: locationAnswer.text || null,
      maxRadiusKm: answers.maxRadius,
    });
  }

  return donorRequestService.createTextSearchRequest({
    searcherParentId: parent._id,
    species: answers.species,
    locationText: locationAnswer.text,
  });
}

/**
 * Appends the prompt for the next queued donor ask, if any remain, once the
 * current one is fully resolved.
 * @param {Object} conversation Conversation document.
 * @param {Array<Object>} replies Reply messages built so far; mutated.
 * @return {Array<Object>} The same replies array.
 */
function withNextPendingAsk(conversation, replies) {
  if (conversation.pendingDonorRequests.length > 0 && conversation.pendingAction !== 'donorAcceptPetSelect') {
    replies.push(reply('You have another request waiting — can you help?', donorRequestService.DONOR_RESPONSE_OPTIONS));
  }
  return replies;
}

/**
 * Builds the "which pet will be donating?" prompt with one tappable option per
 * eligible pet.
 * @param {Array<Object>} pets Eligible Pet documents.
 * @param {string=} prefix Text to show above the question.
 * @return {Object} The reply message.
 */
function donorPetPrompt(pets, prefix) {
  const options = pets.map((p) => ({
    value: `${PET_OPTION_PREFIX}${p._id}`,
    label: `${p.species === 'dog' ? '🐶' : '🐱'} ${p.name || 'Unnamed'}`,
  }));
  return reply(`${prefix ? `${prefix}\n\n` : ''}Which pet will be donating?\n\nType "cancel" to back out.`, options, { listButton: 'View Pets' });
}

/**
 * Records a donor's accept or decline of a request. A decline finishes
 * immediately; an accept picks the only eligible pet or asks which pet is
 * donating.
 * @param {Object} conversation Conversation document.
 * @param {Object} parent PetParent document of the responding donor.
 * @param {string|Object} requestId Id of the DonorRequest.
 * @param {boolean} accepted Whether the donor agreed to help.
 * @return {Promise<Array<Object>>} Reply messages to send, in order.
 * @throws {Error} If the searcher cannot be notified.
 */
async function respondToDonorRequestId(conversation, parent, requestId, accepted) {
  const request = await DonorRequest.findById(requestId);
  if (!request || request.phase === 'stopped' || request.phase === 'expired') {
    return [reply("That request isn't active anymore — thanks anyway! 🐾")];
  }

  await donorRequestService.clearPendingAsk(parent._id, requestId);
  conversation.pendingDonorRequests = conversation.pendingDonorRequests.filter(
    (p) => String(p.requestId) !== String(requestId)
  );

  if (!accepted) {
    await donorRequestService.recordDonorResponse(request, parent._id, { accepted: false });
    return [reply('No worries — thanks for letting us know.')];
  }

  const eligiblePets = await donorRequestService.getEligiblePets(parent._id, request.species);
  if (eligiblePets.length === 0) {
    return [reply("Looks like you don't have an eligible pet for this one right now.")];
  }
  if (eligiblePets.length === 1) {
    await donorRequestService.recordDonorResponse(request, parent._id, { accepted: true, petId: eligiblePets[0]._id });
    return [reply(`Thank you 🐾 We've shared ${eligiblePets[0].name || 'your pet'}'s details with the searcher — they'll reach out directly.`)];
  }

  conversation.pendingAction = 'donorAcceptPetSelect';
  conversation.pendingPetIds = eligiblePets.map((p) => p._id);
  conversation.pendingDonorAcceptRequestId = request._id;
  return [donorPetPrompt(eligiblePets)];
}

/**
 * Handles a donor's yes/no reply to the ask at the head of their pending
 * donor-request queue.
 * @param {Object} conversation Conversation document.
 * @param {Object} input Normalized incoming message.
 * @return {Promise<Array<Object>>} Reply messages to send, in order.
 * @throws {Error} If the searcher cannot be notified.
 */
async function resolveDonorRequestResponse(conversation, input) {
  const result = stepTypes.validators.confirm(input, { optionsOverride: donorRequestService.DONOR_RESPONSE_OPTIONS });
  if (!result.valid) {
    return [reply('Can you help? Please tap a button below.', donorRequestService.DONOR_RESPONSE_OPTIONS)];
  }

  const [head, ...rest] = conversation.pendingDonorRequests;
  conversation.pendingDonorRequests = rest;

  const parent = await accountService.findParent(conversation.channel, conversation.externalUserId);
  if (!parent) {
    return withNextPendingAsk(conversation, [reply("That request isn't active anymore — thanks anyway! 🐾")]);
  }

  const replies = await respondToDonorRequestId(conversation, parent, head.requestId, result.value);
  return withNextPendingAsk(conversation, replies);
}

/**
 * Stops one of the searcher's own searches from the "my searches" list.
 * @param {Object} conversation Conversation document.
 * @param {Object} parent PetParent document of the searcher.
 * @param {string} requestId Id of the DonorRequest to stop.
 * @return {Promise<Array<Object>>} Reply messages to send, in order.
 */
async function stopSearchById(conversation, parent, requestId) {
  const request = await DonorRequest.findById(requestId);
  if (!request || String(request.searcher) !== String(parent._id)) {
    return [reply("Couldn't find that search.")];
  }
  if (request.phase === 'stopped' || request.phase === 'expired') {
    return [reply('That search is already closed.')];
  }
  await donorRequestService.stopRequest(request);
  if (String(conversation.pendingUnlimitedConfirmRequestId) === String(requestId)) {
    conversation.pendingUnlimitedConfirmRequestId = null;
  }
  return [reply('Search stopped. 🐾')];
}

const LIST_PAGE_SIZE = 2;

const SEARCH_PHASE_LABEL = {
  active: '🔍 Searching',
  awaiting_unlimited_confirmation: '🕓 Awaiting your input',
  unlimited: '🔍 Searching (unlimited)',
  stopped: '🛑 Stopped',
  expired: '⌛ Expired (no response)',
};

/**
 * Formats one of the searcher's own searches as a reply, with a stop button
 * while it is still open.
 * @param {Object} r Request summary from listSentForSearcher.
 * @return {Object} The reply message.
 */
function formatSearchItem(r) {
  const area = r.searchMode === 'text' ? `in ${r.locationText || 'your area'}` : `near ${r.locationText || 'your area'}`;
  const radiusPart = r.searchMode === 'text' ? '' : ` (${r.currentRadiusKm}/${r.maxRadiusKm}km)`;
  const header = `${r.species === 'dog' ? '🐶' : '🐱'} ${area}${radiusPart}`;
  const acceptedLines = r.accepted
    .map((a) => `   ✅ ${a.pet?.name || 'Pet'} ${a.pet?.species === 'dog' ? '🐶' : '🐱'} — 👤 ${a.owner?.name || 'Unknown'} 📞 ${a.owner?.phone || 'N/A'}`)
    .join('\n');
  const text = [header, SEARCH_PHASE_LABEL[r.phase] || r.phase, acceptedLines].filter(Boolean).join('\n');
  const isOpen = r.phase !== 'stopped' && r.phase !== 'expired';
  return reply(text, isOpen ? [{ value: `stopSearch:${r._id}`, label: '🛑 Stop this search' }] : undefined);
}

const REQUEST_STATUS_LABEL = {
  pending: '🕓 Pending',
  accepted: '✅ Accepted',
  declined: '🙅 Declined',
  expired: '⌛ Expired (no response)',
};

/**
 * Formats one request the donor was asked about as a reply, with accept and
 * decline buttons while it is pending.
 * @param {Object} r Request summary from listReceivedForOwner.
 * @return {Object} The reply message.
 */
function formatRequestItem(r) {
  const header = `${r.species === 'dog' ? '🐶' : '🐱'} donor request near ${r.locationText || 'nearby'}`;
  const petPart = r.myPet ? ` — ${r.myPet.name || 'your pet'}` : '';
  const contactLine = `👤 ${r.searcher?.name || 'Unknown'}  📞 ${r.searcher?.phone || 'N/A'}`;
  const text = `${header}\n${REQUEST_STATUS_LABEL[r.myStatus] || r.myStatus}${petPart}\n${contactLine}`;
  const options = r.myStatus === 'pending'
    ? [
        { value: `acceptRequest:${r._id}`, label: '✅ I can help' },
        { value: `declineRequest:${r._id}`, label: '🙅 Not this time' },
      ]
    : undefined;
  return reply(text, options);
}

/**
 * Shows one page of the searcher's own searches, with a "Load more" button when
 * another page exists.
 * @param {Object} conversation Conversation document.
 * @param {number} offset Index of the first search to show.
 * @return {Promise<Array<Object>>} Reply messages to send, in order.
 */
async function showSearchesPage(conversation, offset) {
  const parent = await accountService.findParent(conversation.channel, conversation.externalUserId);
  const list = parent ? await donorRequestService.listSentForSearcher(parent._id) : [];
  if (list.length === 0) return [reply("You haven't started any donor searches yet.")];

  const page = list.slice(offset, offset + LIST_PAGE_SIZE);
  const replies = page.map(formatSearchItem);
  if (offset === 0) replies.unshift(reply(`Your donor searches (${list.length}):`));

  if (offset + LIST_PAGE_SIZE < list.length) {
    conversation.pendingListType = 'sentSearches';
    conversation.pendingListOffset = offset + LIST_PAGE_SIZE;
    replies.push(reply('Want to see more?', [{ value: 'loadMore', label: '➡️ Load more' }]));
  } else {
    conversation.pendingListType = null;
    conversation.pendingListOffset = 0;
  }
  return replies;
}

/**
 * Shows one page of the requests the donor has been asked about, with a "Load
 * more" button when another page exists.
 * @param {Object} conversation Conversation document.
 * @param {number} offset Index of the first request to show.
 * @return {Promise<Array<Object>>} Reply messages to send, in order.
 */
async function showRequestsPage(conversation, offset) {
  const parent = await accountService.findParent(conversation.channel, conversation.externalUserId);
  const list = parent ? await donorRequestService.listReceivedForOwner(parent._id) : [];
  if (list.length === 0) return [reply("You haven't been asked to help with any donor requests yet.")];

  const page = list.slice(offset, offset + LIST_PAGE_SIZE);
  const replies = page.map(formatRequestItem);
  if (offset === 0) replies.unshift(reply(`Your donor requests (${list.length}):`));

  if (offset + LIST_PAGE_SIZE < list.length) {
    conversation.pendingListType = 'receivedRequests';
    conversation.pendingListOffset = offset + LIST_PAGE_SIZE;
    replies.push(reply('Want to see more?', [{ value: 'loadMore', label: '➡️ Load more' }]));
  } else {
    conversation.pendingListType = null;
    conversation.pendingListOffset = 0;
  }
  return replies;
}

/**
 * Handles the "which pet will be donating?" reply after a donor with several
 * eligible pets accepted a request.
 * @param {Object} conversation Conversation document.
 * @param {Object} input Normalized incoming message.
 * @return {Promise<Array<Object>>} Reply messages to send, in order.
 * @throws {Error} If the searcher cannot be notified.
 */
async function resolveDonorAcceptPetSelection(conversation, input) {
  const raw = (input.text || '').trim().toLowerCase();

  if (raw === 'cancel' || raw === 'stop' || raw === 'exit') {
    conversation.pendingAction = null;
    conversation.pendingPetIds = [];
    conversation.pendingDonorAcceptRequestId = null;
    return withNextPendingAsk(conversation, [reply('Okay, cancelled — that request is still waiting if you change your mind.')]);
  }

  const petId = matchPendingPetId(conversation, input);
  if (!petId) {
    const pets = await Pet.find({ _id: { $in: conversation.pendingPetIds || [] } }).sort({ createdAt: 1 });
    return [donorPetPrompt(pets, "Sorry, I didn't catch which pet.")];
  }

  const requestId = conversation.pendingDonorAcceptRequestId;
  conversation.pendingAction = null;
  conversation.pendingPetIds = [];
  conversation.pendingDonorAcceptRequestId = null;

  const request = await DonorRequest.findById(requestId);
  const pet = await Pet.findById(petId);
  const parent = await accountService.findParent(conversation.channel, conversation.externalUserId);
  if (!request || request.phase === 'stopped' || !pet || !parent) {
    return withNextPendingAsk(conversation, [reply("That request isn't active anymore — thanks anyway! 🐾")]);
  }

  await donorRequestService.recordDonorResponse(request, parent._id, { accepted: true, petId: pet._id });
  return withNextPendingAsk(conversation, [
    reply(`Thank you 🐾 We've shared ${pet.name || 'your pet'}'s details with the searcher — they'll reach out directly.`),
  ]);
}

/**
 * Handles the searcher's yes/no reply once their search reached its maximum
 * radius with no accepts.
 * @param {Object} conversation Conversation document.
 * @param {Object} input Normalized incoming message.
 * @return {Promise<Array<Object>>} Reply messages to send, in order.
 * @throws {Error} If a notification cannot be sent.
 */
async function resolveUnlimitedConfirm(conversation, input) {
  const result = stepTypes.validators.confirm(input, { optionsOverride: donorRequestService.UNLIMITED_CONFIRM_OPTIONS });
  if (!result.valid) {
    return [reply('Want us to keep looking with no distance limit?', donorRequestService.UNLIMITED_CONFIRM_OPTIONS)];
  }

  const requestId = conversation.pendingUnlimitedConfirmRequestId;
  conversation.pendingUnlimitedConfirmRequestId = null;

  const request = await DonorRequest.findById(requestId);
  if (!request) return [reply("That search isn't active anymore.")];

  if (result.value) {
    request.phase = 'unlimited';
    await request.save();
    await donorRequestService.notifyNewDonorsInRadius(request);
    return [reply("Expanding the search to an unlimited range 🐾 We'll let you know the moment someone says yes.")];
  }

  await donorRequestService.stopRequest(request);
  return [reply('No problem — search stopped. Say "find a pet blood donor" any time to start a new one.')];
}

/**
 * Processes one incoming message end to end: routes it to the right handler
 * (list buttons, pending actions, global commands, the active flow or the main
 * menu) and saves the conversation.
 * @param {{channel: string, externalUserId: string, messageId:
 *     (string|undefined), text: string, payload: *, location: ?Object,
 *     attachment: ?Object}} normalized Channel-agnostic message produced by an
 *     adapter's normalizeIncoming.
 * @return {Promise<Array<Object>>} Reply messages to send, in order; empty for
 *     a duplicate webhook delivery.
 * @throws {Error} If a database, storage, OTP or notification operation fails.
 */
async function handle(normalized) {
  const { channel, externalUserId, text, payload, location, attachment, messageId } = normalized;
  const conversation = await loadOrCreateConversation(channel, externalUserId);

  if (messageId && conversation.lastMessageId === messageId) {
    return [];
  }
  if (messageId) conversation.lastMessageId = messageId;

  const input = { text, payload, location, attachment };
  const command = detectGlobalCommand(text);

  let replies;

  if (payload === 'loadMore' && conversation.pendingListType) {
    replies = conversation.pendingListType === 'sentSearches'
      ? await showSearchesPage(conversation, conversation.pendingListOffset)
      : await showRequestsPage(conversation, conversation.pendingListOffset);
  } else if (typeof payload === 'string' && payload.startsWith('stopSearch:')) {
    const parent = await accountService.findParent(channel, externalUserId);
    replies = parent
      ? await stopSearchById(conversation, parent, payload.slice('stopSearch:'.length))
      : [reply("We couldn't find a profile for you yet.")];
  } else if (typeof payload === 'string' && (payload.startsWith('acceptRequest:') || payload.startsWith('declineRequest:'))) {
    const accepted = payload.startsWith('acceptRequest:');
    const requestId = payload.slice(payload.indexOf(':') + 1);
    const parent = await accountService.findParent(channel, externalUserId);
    replies = parent
      ? await respondToDonorRequestId(conversation, parent, requestId, accepted)
      : [reply("We couldn't find a profile for you yet.")];
  } else if (typeof payload === 'string' && payload.startsWith(VIEW_DOC_PREFIX)) {
    replies = await openDocument(conversation, payload);
  } else if (typeof payload === 'string' && payload.startsWith(VIEW_DOCS_PAGE_PREFIX)) {
    replies = await showDocumentsPage(conversation, payload);
  } else if (payload === 'mySearches') {
    replies = await showSearchesPage(conversation, 0);
  } else if (payload === 'myRequests') {
    replies = await showRequestsPage(conversation, 0);
  } else if (conversation.pendingDonorRequests.length > 0 && !conversation.pendingAction && !conversation.flow) {
    replies = await resolveDonorRequestResponse(conversation, input);
  } else if (conversation.pendingUnlimitedConfirmRequestId && !conversation.pendingAction && !conversation.flow) {
    replies = await resolveUnlimitedConfirm(conversation, input);
  } else if (conversation.pendingAction === 'pauseSelect' && command !== 'CANCEL') {
    replies = await resolvePauseSelection(conversation, text);
  } else if (conversation.pendingAction === 'recordsPhone' && command !== 'CANCEL') {
    replies = await resolveRecordsPhone(conversation, input);
  } else if (conversation.pendingAction === 'recordsOtp' && command !== 'CANCEL') {
    replies = await resolveRecordsOtp(conversation, input);
  } else if (conversation.pendingAction === 'uploadRecordsSelect' && command !== 'CANCEL') {
    replies = await resolveUploadPetSelection(conversation, input);
  } else if (conversation.pendingAction === 'uploadRecordsConfirm' && command !== 'CANCEL') {
    replies = await resolveUploadConfirm(conversation, input);
  } else if (conversation.pendingAction === 'uploadRecordsFile' && command !== 'CANCEL') {
    replies = await resolveUploadFile(conversation, input);
  } else if (conversation.pendingAction === 'viewRecordsSelect' && command !== 'CANCEL') {
    replies = await resolveViewPetSelection(conversation, input);
  } else if (conversation.pendingAction === 'donorAcceptPetSelect' && command !== 'CANCEL') {
    replies = await resolveDonorAcceptPetSelection(conversation, input);
  } else if (command) {
    replies = await handleGlobalCommand(command, conversation);
  } else if (conversation.flow) {
    const result = await flowEngine.advance(conversation, input);
    if (result.error) {
      replies = [flowReply(result, result.error)];
    } else if (result.done) {
      const answers = withChannelVerifiedPhone(conversation, result.answers);
      if (result.flow === 'registerDonor') {
        await persistRegisteredDonor(conversation, resolveRegisterDonorAnswers(answers));
        replies = [
          reply(
            "Welcome to the pack. 🐾\nYour pet is now listed as a Bloodhound donor.\nIf they're a match for a pet in need, their human will be able to contact you directly.\nThank you for being part of a community that shows up for each other.\n\nSay \"my requests\" any time to see who's asked for their help."
          ),
        ];
      } else if (result.flow === 'findDonor') {
        const statusText = await startDonorRequest(conversation, resolveFindDonorAnswers(answers));
        replies = [reply(statusText)];
      }
      flowEngine.reset(conversation);
      conversation.currentStepId = null;
    } else {
      replies = [flowReply(result)];
    }
  } else if (conversation.currentStepId !== 'menu') {
    conversation.currentStepId = 'menu';
    replies = [reply(OPENING_MESSAGE), reply(MENU_STEP.prompt(), MENU_STEP.options)];
  } else {
    const result = stepTypes.validators.choice(input, MENU_STEP);
    if (!result.valid) {
      replies = [reply(`${result.error}\n\n${MENU_STEP.prompt()}`, MENU_STEP.options)];
    } else if (result.value === 'uploadRecords') {
      replies = await startRecordsFlow(conversation, 'upload');
    } else if (result.value === 'viewRecords') {
      replies = await startRecordsFlow(conversation, 'view');
    } else if (result.value === 'mySearches') {
      replies = await showSearchesPage(conversation, 0);
    } else if (result.value === 'myRequests') {
      replies = await showRequestsPage(conversation, 0);
    } else {
      conversation.consentAcceptedAt = conversation.consentAcceptedAt || new Date();
      const startOptions = await flowStartOptions(conversation, result.value);
      const started = await flowEngine.start(conversation, result.value, startOptions);
      replies = [flowReply(started)];
    }
  }

  await conversation.save();
  return replies;
}

module.exports = { handle, OPENING_MESSAGE, MENU_STEP };
