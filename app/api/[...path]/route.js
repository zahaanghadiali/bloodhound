const { dispatch } = require('../../../server/router');

/**
 * The only route file in the app — every /api/* request lands here and is
 * dispatched to a controller in server/controllers/ via server/router.js.
 */
module.exports = { GET: dispatch, POST: dispatch, PATCH: dispatch, PUT: dispatch, DELETE: dispatch };
