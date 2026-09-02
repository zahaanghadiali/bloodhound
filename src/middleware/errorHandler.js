const logger = require('../utils/logger');

// eslint-disable-next-line no-unused-vars
module.exports = function errorHandler(err, req, res, next) {
  logger.error(err.message, { stack: err.stack, path: req.path });
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
};
