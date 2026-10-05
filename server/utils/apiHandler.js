const { NextResponse } = require('next/server');
const { connectDb } = require('../config/db');
const logger = require('./logger');

/**
 * Wraps a Next.js route handler so the database connection is ready before it
 * runs and any error it throws becomes a JSON error response.
 * @param {function(Request, Object): Promise<Response>} fn Route handler to
 *     wrap.
 * @return {function(Request, Object): Promise<Response>} Handler that never
 *     throws; failures resolve to a JSON body with the error's status (500 by
 *     default).
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
