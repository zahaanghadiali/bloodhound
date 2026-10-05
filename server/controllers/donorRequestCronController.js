const crypto = require('crypto');
const { NextResponse } = require('next/server');
const { apiHandler } = require('../utils/apiHandler');
const DonorRequest = require('../models/DonorRequest');
const donorRequestService = require('../services/donorRequestService');
const { donorRequest: config } = require('../config/env');

/**
 * Compares a provided cron secret with the configured one in constant time, so
 * it cannot be brute-forced through response-time differences.
 * @param {?string} provided Value of the x-cron-secret header.
 * @return {boolean} True if a secret is configured and the provided one
 *     matches.
 */
function isValidSecret(provided) {
  if (!config.cronSecret || !provided) return false;
  const expected = Buffer.from(config.cronSecret);
  const actual = Buffer.from(String(provided));
  if (expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(expected, actual);
}

/**
 * Handles GET /api/donor-requests/tick, called by an external scheduler.
 * Expands every due active request by one step, re-scans unlimited requests for
 * newly in-range donors, and expires stale requests.
 * @param {Request} req Request carrying the x-cron-secret header.
 * @return {Promise<Response>} JSON with counts of due, expanded, re-notified
 *     and expired requests; 401 if the secret is wrong.
 */
const tick = apiHandler(async (req) => {
  if (!isValidSecret(req.headers.get('x-cron-secret'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const due = await DonorRequest.find({
    phase: { $in: ['active', 'unlimited'] },
    nextExpansionAt: { $lte: new Date() },
  });

  let expanded = 0;
  let reNotified = 0;
  for (const request of due) {
    if (request.phase === 'active') {
      await donorRequestService.expandRequest(request);
      expanded += 1;
    } else {
      await donorRequestService.reNotifyUnlimited(request);
      reNotified += 1;
    }
  }

  const { expiredRequests, expiredAsks } = await donorRequestService.expireStaleRequests();

  return NextResponse.json({ ok: true, due: due.length, expanded, reNotified, expiredRequests, expiredAsks });
});

module.exports = { tick };
