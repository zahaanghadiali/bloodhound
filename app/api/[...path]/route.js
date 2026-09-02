const { dispatch } = require('../../../api/router');

/**
 * The only route file in the app — every /api/* request lands here and is
 * dispatched to a controller in api/controllers/ via api/router.js.
 */
module.exports = { GET: dispatch, POST: dispatch, PATCH: dispatch, PUT: dispatch, DELETE: dispatch };
