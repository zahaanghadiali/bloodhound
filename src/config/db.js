const mongoose = require('mongoose');
const { mongodbUri } = require('./env');
const logger = require('../utils/logger');

async function connectDb() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(mongodbUri);
  logger.info(`MongoDB connected: ${mongodbUri}`);
  return mongoose.connection;
}

module.exports = { connectDb };
