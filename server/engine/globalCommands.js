/**
 * Commands that work at ANY point in ANY flow, so a user can correct course
 * or manage their account without being stuck in the current step.
 */

const COMMANDS = {
  BACK: ['back', 'go back', 'previous', '⬅️'],
  RESTART: ['restart', 'start over', 'menu', 'main menu'],
  CANCEL: ['cancel', 'stop', 'exit'],
  PAUSE: ['pause', 'pause profile', 'pause my profile'],
  RESUME: ['resume', 'unpause', 'resume my profile'],
  DELETE: ['delete', 'delete my profile', 'delete profile', 'remove me'],
  STOP_SEARCH: ['stop searching', 'end search', 'stop search', 'cancel search'],
  MY_REQUESTS: ['my requests', 'requests', 'view requests'],
  MY_SEARCHES: ['my searches', 'my search', 'search status'],
  HELP: ['help', '?'],
};

function detectGlobalCommand(text) {
  const normalized = (text || '').trim().toLowerCase();
  if (!normalized) return null;
  for (const [command, phrases] of Object.entries(COMMANDS)) {
    if (phrases.includes(normalized)) return command;
  }
  return null;
}

module.exports = { detectGlobalCommand, COMMANDS };
