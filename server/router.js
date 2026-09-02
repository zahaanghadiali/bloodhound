const { NextResponse } = require('next/server');
const healthController = require('./controllers/healthController');
const mockController = require('./controllers/mockController');
const conversationsController = require('./controllers/conversationsController');
const donorsController = require('./controllers/donorsController');
const petParentsController = require('./controllers/petParentsController');
const petsController = require('./controllers/petsController');
const webhooksController = require('./controllers/webhooksController');
const geoController = require('./controllers/geoController');

/**
 * Route table for the single `/api/[...path]` catch-all — every other file
 * under app/api/ is just this dispatcher. Each entry maps a method + path
 * pattern (":name" segments become params) to a controller function; adding
 * an endpoint means adding a row here and a function in api/controllers/,
 * never a new route.js file.
 */
const routes = [
  { method: 'GET', pattern: 'health', handler: healthController.check },

  { method: 'POST', pattern: 'mock/incoming', handler: mockController.incoming },

  { method: 'GET', pattern: 'conversations/:id', handler: conversationsController.get },
  { method: 'POST', pattern: 'conversations/:id/pause', handler: conversationsController.pause },
  { method: 'POST', pattern: 'conversations/:id/resume', handler: conversationsController.resume },
  { method: 'POST', pattern: 'conversations/:id/delete', handler: conversationsController.remove },

  { method: 'GET', pattern: 'donors/search', handler: donorsController.search },

  { method: 'GET', pattern: 'pet-parents', handler: petParentsController.list },
  { method: 'POST', pattern: 'pet-parents', handler: petParentsController.create },
  { method: 'GET', pattern: 'pet-parents/:id', handler: petParentsController.get },
  { method: 'PATCH', pattern: 'pet-parents/:id', handler: petParentsController.update },

  { method: 'GET', pattern: 'pets', handler: petsController.list },
  { method: 'POST', pattern: 'pets', handler: petsController.create },
  { method: 'GET', pattern: 'pets/:id', handler: petsController.get },
  { method: 'PATCH', pattern: 'pets/:id', handler: petsController.update },

  { method: 'GET', pattern: 'webhooks/whatsapp', handler: webhooksController.verifyWhatsapp },
  { method: 'POST', pattern: 'webhooks/whatsapp', handler: webhooksController.receiveWhatsapp },
  { method: 'GET', pattern: 'webhooks/instagram', handler: webhooksController.verifyInstagram },
  { method: 'POST', pattern: 'webhooks/instagram', handler: webhooksController.receiveInstagram },

  { method: 'GET', pattern: 'geo/countries', handler: geoController.countries },
  { method: 'GET', pattern: 'geo/cities', handler: geoController.cities },
];

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

/** Resolves an incoming request against the route table and runs its controller. */
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
