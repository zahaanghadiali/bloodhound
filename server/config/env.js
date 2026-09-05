// Next.js loads .env / .env.local automatically — no dotenv needed here.

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  mongodbUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/bloodhound',
  // Kept separate from the URI so the same cluster can host distinct
  // test/production databases just by swapping this one var. Defaults to
  // 'test' — the MongoDB driver's own default when no db name is given —
  // so this matches whatever this app was already connecting to before
  // MONGODB_DB_NAME existed.
  mongodbDbName: process.env.MONGODB_DB_NAME || 'test',
  defaultSearchRadiusKm: parseFloat(process.env.DEFAULT_SEARCH_RADIUS_KM) || 10,
  // Phone numbers are the real account identity (see identityService), so a
  // bare local number and its full E.164 form must always canonicalize to
  // the same string — see stepTypes.validators.phone. Matches the web
  // sign-in page's own country picker default (components/auth/lib/countryDialCodes.js).
  defaultCountryCallingCode: process.env.DEFAULT_COUNTRY_CALLING_CODE || '+91',
  donorRequest: {
    // Expanding-radius donor search: starts small, widens every
    // expansionIntervalMinutes up to a searcher-chosen max, then asks
    // whether to go unlimited. The tick itself is driven by an external
    // cron hitting /api/donor-requests/tick (see donorRequestCronController)
    // rather than an in-process timer — this app runs serverless, so
    // nothing survives between requests to "wait 5 minutes" on its own.
    startRadiusKm: parseFloat(process.env.DONOR_REQUEST_START_RADIUS_KM) || 5,
    expansionStepKm: parseFloat(process.env.DONOR_REQUEST_EXPANSION_STEP_KM) || 10,
    expansionIntervalMinutes: parseFloat(process.env.DONOR_REQUEST_EXPANSION_INTERVAL_MINUTES) || 5,
    cronSecret: process.env.DONOR_REQUEST_CRON_SECRET || '',
  },
  whatsapp: {
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || '',
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    appSecret: process.env.WHATSAPP_APP_SECRET || '',
  },
  instagram: {
    verifyToken: process.env.INSTAGRAM_VERIFY_TOKEN || '',
    accessToken: process.env.INSTAGRAM_ACCESS_TOKEN || '',
    appSecret: process.env.INSTAGRAM_APP_SECRET || '',
  },
  otp: {
    // 'mock' needs no API keys — the code is echoed into the chat reply itself.
    smsProvider: process.env.OTP_SMS_PROVIDER || 'mock',
    emailProvider: process.env.OTP_EMAIL_PROVIDER || 'mock',
    codeTtlMinutes: parseFloat(process.env.OTP_CODE_TTL_MINUTES) || 5,
    hashSecret: process.env.OTP_HASH_SECRET || 'dev-otp-secret-change-me',
  },
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    fromNumber: process.env.TWILIO_FROM_NUMBER || '',
  },
  resend: {
    apiKey: process.env.RESEND_API_KEY || '',
    fromAddress: process.env.EMAIL_FROM_ADDRESS || 'Bloodhound <onboarding@resend.dev>',
  },
  documentStorage: {
    // 'inline' needs no setup — files are kept as base64 data URLs on the
    // Pet document. Switch to 's3' (with the AWS_* vars below) for real
    // object storage. The bucket is treated as private: documents are
    // served via short-lived signed URLs, never a permanent public link.
    provider: process.env.DOCUMENT_STORAGE_PROVIDER || 'inline',
    signedUrlTtlSeconds: parseInt(process.env.DOCUMENT_SIGNED_URL_TTL_SECONDS, 10) || 900,
  },
  aws: {
    region: process.env.AWS_REGION || '',
    bucket: process.env.AWS_S3_BUCKET || '',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
  records: {
    // Once a device/session OTP-verifies a phone number for the medical
    // records flows, it isn't asked again for this many days. WhatsApp
    // never needs this — the channel itself proves the phone number on
    // every message.
    phoneVerificationTtlDays: parseFloat(process.env.RECORDS_VERIFICATION_TTL_DAYS) || 180,
  },
};
