const { NextResponse } = require('next/server');
const authController = require('./controllers/authController');
const healthController = require('./controllers/healthController');
const mockController = require('./controllers/mockController');
const conversationsController = require('./controllers/conversationsController');
const donorRequestCronController = require('./controllers/donorRequestCronController');
const donorRequestsController = require('./controllers/donorRequestsController');
const petParentsController = require('./controllers/petParentsController');
const petsController = require('./controllers/petsController');
const webhooksController = require('./controllers/webhooksController');
const geoController = require('./controllers/geoController');

const routes = [
  { method: 'GET', pattern: 'health', handler: healthController.check },

  { method: 'POST', pattern: 'auth/request-otp', handler: authController.requestOtp },
  { method: 'POST', pattern: 'auth/resend-otp', handler: authController.resendOtp },
  { method: 'POST', pattern: 'auth/verify-otp', handler: authController.verifyOtp },
  { method: 'POST', pattern: 'auth/logout', handler: authController.logout },
  { method: 'GET', pattern: 'auth/me', handler: authController.me },

  { method: 'POST', pattern: 'mock/incoming', handler: mockController.incoming },

  { method: 'GET', pattern: 'conversations/:id', handler: conversationsController.get },
  { method: 'POST', pattern: 'conversations/:id/pause', handler: conversationsController.pause },
  { method: 'POST', pattern: 'conversations/:id/resume', handler: conversationsController.resume },
  { method: 'POST', pattern: 'conversations/:id/delete', handler: conversationsController.remove },

  { method: 'GET', pattern: 'donor-requests/tick', handler: donorRequestCronController.tick },
  { method: 'GET', pattern: 'donor-requests/sent', handler: donorRequestsController.listSent },
  { method: 'POST', pattern: 'donor-requests/sent/:id/stop', handler: donorRequestsController.stopSent },
  { method: 'GET', pattern: 'donor-requests/received', handler: donorRequestsController.listReceived },
  { method: 'POST', pattern: 'donor-requests/received/:id/respond', handler: donorRequestsController.respond },

  { method: 'GET', pattern: 'pet-parents', handler: petParentsController.list },
  { method: 'POST', pattern: 'pet-parents', handler: petParentsController.create },
  { method: 'GET', pattern: 'pet-parents/:id', handler: petParentsController.get },
  { method: 'PATCH', pattern: 'pet-parents/:id', handler: petParentsController.update },

  { method: 'GET', pattern: 'pets', handler: petsController.list },
  { method: 'POST', pattern: 'pets', handler: petsController.create },
  { method: 'GET', pattern: 'pets/:id', handler: petsController.get },
  { method: 'PATCH', pattern: 'pets/:id', handler: petsController.update },
  { method: 'POST', pattern: 'pets/:id/documents', handler: petsController.addDocument },
  { method: 'PATCH', pattern: 'pets/:id/documents/:docId', handler: petsController.updateDocumentStatus },
  { method: 'DELETE', pattern: 'pets/:id/documents/:docId', handler: petsController.removeDocument },

  { method: 'GET', pattern: 'webhooks/whatsapp', handler: webhooksController.verifyWhatsapp },
  { method: 'POST', pattern: 'webhooks/whatsapp', handler: webhooksController.receiveWhatsapp },
  { method: 'GET', pattern: 'webhooks/instagram', handler: webhooksController.verifyInstagram },
  { method: 'POST', pattern: 'webhooks/instagram', handler: webhooksController.receiveInstagram },

  { method: 'GET', pattern: 'geo/countries', handler: geoController.countries },
  { method: 'GET', pattern: 'geo/cities', handler: geoController.cities },
];

/**
 * Matches URL path segments against a route pattern, capturing ":name"
 * segments.
 * @param {string} pattern Route pattern such as 'pets/:id/documents'.
 * @param {Array<string>} segments Path segments of the incoming request.
 * @return {?Object<string, string>} Captured params, or null if the path does
 *     not match.
 */
function matchPattern(pattern, segments) {
  const patternParts = pattern.split('/').filter(Boolean);
  if (patternParts.length !== segments.length) return null;

  const params = {};
  for (let i = 0; i < patternParts.length; i += 1) {
    const part = patternParts[i];
    if (part.startsWith(':')) {
      params[part.slice(1)] = segments[i];
    } else if (part !== segments[i]) {
      return null;
    }
  }
  return params;
}

/**
 * Resolves an incoming request against the route table and runs its controller.
 * @param {Request} req Incoming request.
 * @param {{params: Promise<{path: (Array<string>|undefined)}>}} ctx Route
 *     context from the /api/[...path] catch-all.
 * @return {Promise<Response>} The controller's response, or a 404 JSON response
 *     when no route matches.
 */
async function dispatch(req, ctx) {
  const { path } = (await ctx.params) || {};
  const segments = Array.isArray(path) ? path : [];

  for (const route of routes) {
    if (route.method !== req.method) continue;
    const params = matchPattern(route.pattern, segments);
    if (params) return route.handler(req, { params });
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

module.exports = { dispatch };
