// Next.js loads .env / .env.local automatically — no dotenv needed here.

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  mongodbUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/bloodhound',
  defaultSearchRadiusKm: parseFloat(process.env.DEFAULT_SEARCH_RADIUS_KM) || 10,
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
};
