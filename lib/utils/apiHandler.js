const { NextResponse } = require('next/server');
const { connectDb } = require('../config/db');
const logger = require('./logger');

/**
 * Wraps a Next.js route handler: ensures the DB connection is ready, and
 * turns thrown errors into a JSON error response (the errorHandler
 * middleware equivalent for App Router route handlers).
 */
function apiHandler(fn) {
  return async (req, ctx) => {
    try {
      await connectDb();
      return await fn(req, ctx);
    } catch (err) {
      logger.error(err.message, { stack: err.stack });
      return NextResponse.json({ error: err.message || 'Internal server error' }, { status: err.status || 500 });
    }
  };
}

module.exports = { apiHandler };
