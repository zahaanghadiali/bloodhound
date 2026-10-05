/**
 * Writes one structured JSON log entry to the console.
 * @param {string} level Severity: 'info', 'warn' or 'error'. Errors go to
 *     stderr, everything else to stdout.
 * @param {string} message Human-readable log message.
 * @param {Object=} meta Extra structured context to attach to the entry.
 */
function log(level, message, meta) {
  const entry = { level, message, time: new Date().toISOString(), ...(meta ? { meta } : {}) };
  console[level === 'error' ? 'error' : 'log'](JSON.stringify(entry));
}

module.exports = {
  info: (message, meta) => log('info', message, meta),
  warn: (message, meta) => log('warn', message, meta),
  error: (message, meta) => log('error', message, meta),
};
