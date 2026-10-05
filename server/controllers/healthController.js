const { NextResponse } = require('next/server');

/**
 * Handles GET /api/health.
 * @return {Promise<Response>} JSON with status 'ok'.
 */
const check = async () => NextResponse.json({ status: 'ok' });

module.exports = { check };
