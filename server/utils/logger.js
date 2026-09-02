/* Minimal structured logger. Swap for pino/winston later without touching call sites. */
function log(level, message, meta) {
  const entry = { level, message, time: new Date().toISOString(), ...(meta ? { meta } : {}) };
  // eslint-disable-next-line no-console
  console[level === 'error' ? 'error' : 'log'](JSON.stringify(entry));
}

module.exports = {
  info: (message, meta) => log('info', message, meta),
  warn: (message, meta) => log('warn', message, meta),
  error: (message, meta) => log('error', message, meta),
};
