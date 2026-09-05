const crypto = require('crypto');
const { NextResponse } = require('next/server');
const { apiHandler } = require('../utils/apiHandler');
const DonorRequest = require('../models/DonorRequest');
const donorRequestService = require('../services/donorRequestService');
const { donorRequest: config } = require('../config/env');

/** Constant-time comparison so a mismatched secret can't be brute-forced via response-time differences. */
function isValidSecret(provided) {
  if (!config.cronSecret || !provided) return false;
  const expected = Buffer.from(config.cronSecret);
  const actual = Buffer.from(String(provided));
  if (expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(expected, actual);
}

/**
 * GET /api/donor-requests/tick — meant to be hit by an external scheduler
 * (this app has no in-process cron; see donorRequestService's header
 * comment). Expands every due DonorRequest one step, or re-scans for newly
 * in-range donors once a request has gone unlimited.
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
