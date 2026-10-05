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

/**
 * Detects a command that works at any point in any flow, such as "back" or
 * "cancel".
 * @param {?string} text Raw message text from the user.
 * @return {?string} The matching COMMANDS key, or null if the text is not a
 *     global command.
 */
function detectGlobalCommand(text) {
  const normalized = (text || '').trim().toLowerCase();
  if (!normalized) return null;
  for (const [command, phrases] of Object.entries(COMMANDS)) {
    if (phrases.includes(normalized)) return command;
  }
  return null;
}

module.exports = { detectGlobalCommand, COMMANDS };
