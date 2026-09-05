const Conversation = require('../models/Conversation');
const PetParent = require('../models/PetParent');
const Pet = require('../models/Pet');
const DonorRequest = require('../models/DonorRequest');
const flowEngine = require('../engine/flowEngine');
const stepTypes = require('../engine/stepTypes');
const { detectGlobalCommand } = require('../engine/globalCommands');
const accountService = require('../services/accountService');
const identityService = require('../services/identityService');
const donorRequestService = require('../services/donorRequestService');
const otpService = require('../services/otpService');
const { storeDocument } = require('../services/documentStorageService');
const { maskPhone } = require('../utils/mask');
const { records: recordsConfig } = require('../config/env');

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
 * Atomic get-or-create: a plain findOne-then-`new Conversation()` has a race
 * window where two near-simultaneous first messages for the same
 * {channel, externalUserId} (e.g. the same signed-in account open in two
 * tabs) both see "doesn't exist yet" and both try to create one, tripping
 * the unique index. findOneAndUpdate's upsert is a single atomic operation,
 * so only one of them actually inserts; the other just fetches it.
 */
async function loadOrCreateConversation(channel, externalUserId) {
  return Conversation.findOneAndUpdate(
    { channel, externalUserId },
    { $setOnInsert: { channel, externalUserId, answers: new Map(), history: [] } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
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
    locationText: isGeoPoint ? locationAnswer.text || null : locationAnswer.text,
    phoneVerifiedAt: answers.parentPhoneOtp || null,
    emailVerifiedAt: answers.parentEmailOtp || null,
    deletedAt: null,
  };

  // Resolve by phone, not just this device's externalUserId — the same
  // person registering a second pet from a fresh anonymous session (or
  // after signing in) must land on their existing account, not fork a new one.
  const { parent: resolved } = await identityService.resolveParentByPhone({ channel, externalUserId, phone: answers.parentPhone });
  const parent = await PetParent.findByIdAndUpdate(resolved._id, { $set: parentUpdate }, { new: true });

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
  return [reply("What's the phone number on your Bloodhound profile (with country code, e.g. +91 98765 43210)? 📞")];
}

/** Resolves the phone number entered for startRecordsFlow — looks up the owner and, if found, sends an OTP to confirm it's really them. */
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

/** Upserts the searcher's own PetParent record (findDonor never registers a Pet) from the flow's name/phone/OTP answers. */
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

/** Starts (or refuses to duplicate) an expanding-radius donor search once findDonor completes. */
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

/** Appends the next queued ask's prompt, if any remain, after the current one is fully resolved. */
function withNextPendingAsk(conversation, replies) {
  if (conversation.pendingDonorRequests.length > 0 && conversation.pendingAction !== 'donorAcceptPetSelect') {
    replies.push(reply('You have another request waiting — can you help?', donorRequestService.DONOR_RESPONSE_OPTIONS));
  }
  return replies;
}

/**
 * Core accept/decline handler, shared by the proactive queue-based ask
 * (resolveDonorRequestResponse) and the "my requests" list's per-item
 * Accept/Decline buttons (handled directly by payload in handle()). A
 * decline finishes immediately; an accept needs to know which pet is
 * donating — auto-picked if there's only one eligible, otherwise this hands
 * off to resolveDonorAcceptPetSelection via pendingAction.
 */
async function respondToDonorRequestId(conversation, parent, requestId, accepted) {
  const request = await DonorRequest.findById(requestId);
  if (!request || request.phase === 'stopped' || request.phase === 'expired') {
    return [reply("That request isn't active anymore — thanks anyway! 🐾")];
  }

  // Also drop it from the proactive-ask queue (a no-op if it isn't there),
  // so responding via the list doesn't leave a stale duplicate ask pending.
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
  const petList = eligiblePets.map((p, i) => `${i + 1}. ${p.name || 'Unnamed'} ${p.species === 'dog' ? '🐶' : '🐱'}`).join('\n');
  return [reply(`Which pet will be donating?\n${petList}\n\nReply with a number.`)];
}

/**
 * Resolves a donor's reply to the head of their pendingDonorRequests queue
 * (the proactive "can you help?" push, answered with a plain yes/no).
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

/** Stops one of the searcher's own searches, by id, from the "my searches" list's Stop button. */
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

/** Renders one page (LIST_PAGE_SIZE items) of the searcher's own searches, with a "Load more" button if there's another page. */
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

/** Renders one page (LIST_PAGE_SIZE items) of requests the donor has been asked about, with a "Load more" button if there's another page. */
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

/** Resolves the "which pet will be donating?" reply from resolveDonorRequestResponse's multi-pet branch. */
async function resolveDonorAcceptPetSelection(conversation, text) {
  const raw = (text || '').trim().toLowerCase();
  const petIds = conversation.pendingPetIds || [];

  if (raw === 'cancel' || raw === 'stop' || raw === 'exit') {
    conversation.pendingAction = null;
    conversation.pendingPetIds = [];
    conversation.pendingDonorAcceptRequestId = null;
    return withNextPendingAsk(conversation, [reply('Okay, cancelled — that request is still waiting if you change your mind.')]);
  }

  const index = parseInt(raw, 10);
  const petId = Number.isInteger(index) && index >= 1 && index <= petIds.length ? petIds[index - 1] : null;
  if (!petId) {
    return [reply('Please reply with a number from the list, or "cancel" to back out.')];
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

/** Resolves the searcher's yes/no reply once their search hit maxRadiusKm with no accepts. */
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

  // Unambiguous per-item buttons from a "my searches"/"my requests" list
  // (see showSearchesPage/showRequestsPage) — these carry their own target
  // id, so they're resolved directly by payload rather than through
  // pendingAction/flow state, and take priority over whatever else is going on.
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
  } else if (payload === 'mySearches') {
    // Also reachable via the pendingDonorRequests queue-intercept below, so
    // this must be checked first — otherwise tapping "My searches" while a
    // proactive ask is pending gets misread as an answer to that ask.
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
    replies = await resolveUploadPetSelection(conversation, text);
  } else if (conversation.pendingAction === 'uploadRecordsConfirm' && command !== 'CANCEL') {
    replies = await resolveUploadConfirm(conversation, input);
  } else if (conversation.pendingAction === 'uploadRecordsFile' && command !== 'CANCEL') {
    replies = await resolveUploadFile(conversation, input);
  } else if (conversation.pendingAction === 'viewRecordsSelect' && command !== 'CANCEL') {
    replies = await resolveViewPetSelection(conversation, text);
  } else if (conversation.pendingAction === 'donorAcceptPetSelect' && command !== 'CANCEL') {
    replies = await resolveDonorAcceptPetSelection(conversation, text);
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
            "Welcome to the pack. 🐾\nYour pet is now listed as a Bloodhound donor.\nIf they're a match for a pet in need, their human will be able to contact you directly.\nThank you for being part of a community that shows up for each other.\n\nSay \"my requests\" any time to see who's asked for their help."
          ),
        ];
      } else if (result.flow === 'findDonor') {
        const statusText = await startDonorRequest(conversation, result.answers);
        replies = [reply(statusText)];
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
    } else if (result.value === 'mySearches') {
      replies = await showSearchesPage(conversation, 0);
    } else if (result.value === 'myRequests') {
      replies = await showRequestsPage(conversation, 0);
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
