require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3000,
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
};
