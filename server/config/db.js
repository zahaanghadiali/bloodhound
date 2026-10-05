const mongoose = require('mongoose');
const { mongodbUri, mongodbDbName } = require('./env');
const logger = require('../utils/logger');

let cached = global._mongooseConn;
if (!cached) {
  cached = global._mongooseConn = { conn: null, promise: null };
}

/**
 * Connects to MongoDB, reusing a connection cached on `global` so warm
 * serverless instances do not open a new connection per request.
 * @return {Promise<Object>} The connected mongoose instance.
 * @throws {Error} If the connection to MongoDB fails.
 */
async function connectDb() {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    mongoose.set('strictQuery', true);
    cached.promise = mongoose.connect(mongodbUri, { dbName: mongodbDbName }).then((m) => {
      logger.info(`MongoDB connected: db="${mongodbDbName}"`);
      return m;
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

module.exports = { connectDb };
