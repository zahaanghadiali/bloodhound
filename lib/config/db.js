const mongoose = require('mongoose');
const { mongodbUri } = require('./env');
const logger = require('../utils/logger');

/*
 * Vercel runs API routes as serverless functions: each invocation can land on
 * a fresh instance, but warm instances reuse the same Node process. Caching
 * the connection (and in-flight connect promise) on `global` avoids opening a
 * new MongoDB connection per request/reusing a half-open one across warm
 * invocations, which otherwise exhausts the connection pool under load.
 */
let cached = global._mongooseConn;
if (!cached) {
  cached = global._mongooseConn = { conn: null, promise: null };
}

async function connectDb() {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    mongoose.set('strictQuery', true);
    cached.promise = mongoose.connect(mongodbUri).then((m) => {
      logger.info(`MongoDB connected: ${mongodbUri}`);
      return m;
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

module.exports = { connectDb };
