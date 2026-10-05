module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  mongodbUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/bloodhound',
  mongodbDbName: process.env.MONGODB_DB_NAME || 'bloodhoundDB-UAT',
  trustWebSessionPhone: process.env.TRUST_WEB_SESSION_PHONE === 'true',
  defaultSearchRadiusKm: parseFloat(process.env.DEFAULT_SEARCH_RADIUS_KM) || 10,
  defaultCountryCallingCode: process.env.DEFAULT_COUNTRY_CALLING_CODE || '+91',
  donorRequest: {
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
    provider: process.env.DOCUMENT_STORAGE_PROVIDER || 'inline',
    signedUrlTtlSeconds: parseInt(process.env.DOCUMENT_SIGNED_URL_TTL_SECONDS, 10) || 900,
  },
  aws: {
    region: process.env.AWS_REGION || '',
    bucket: process.env.AWS_S3_BUCKET || '',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
  geocoding: {
    googleApiKey: process.env.GOOGLE_MAPS_API_KEY || '',
    contactEmail: process.env.GEOCODING_CONTACT_EMAIL || '',
    timeoutMs: parseInt(process.env.GEOCODING_TIMEOUT_MS, 10) || 4000,
  },
  records: {
    phoneVerificationTtlDays: parseFloat(process.env.RECORDS_VERIFICATION_TTL_DAYS) || 180,
  },
};
