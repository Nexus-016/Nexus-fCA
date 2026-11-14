const chalk = require('chalk');
const gradient = require('gradient-string');

const infoGradient = gradient(['#00c6ff', '#0072ff']); // blue-cyan gradient
const warnColor = chalk.yellow.bold;
const errorColor = chalk.red.bold;
const successColor = chalk.green.bold;

const LEVELS = new Set(['warn', 'error', 'info', 'success', 'debug']);

/**
 * Dual-signature logger:
 *   logger("message", "level")                 — legacy FCA style
 *   logger("Module", "message", "level")       — module style (CookieRefresher, etc.)
 * The second form previously printed the module name as the message and
 * dropped the real text (the level argument landed in the message slot).
 */
module.exports = (text, type, level) => {
  if (typeof level === 'string' && typeof type === 'string') {
    text = `[${text}] ${type}`;
    type = level;
  }
  if (type === 'debug') {
    if (!process.env.NEXUS_DEBUG) return;
    type = 'info';
  }
  switch (type) {
    case "warn":
      process.stderr.write(warnColor(`\r[ WARN ] › ${text}`) + '\n');
      break;
    case "error":
      process.stderr.write(errorColor(`\r[ ERROR ] › ${text}`) + '\n');
      break;
    case "success":
      process.stderr.write(successColor(`\r[ Nexus-FCA ] › ${text}`) + '\n');
      break;
    case "info":
      process.stderr.write(infoGradient(`\r[ Nexus-FCA ] › ${text}`) + '\n');
      break;
    default:
      process.stderr.write(infoGradient(`\r[ Nexus-FCA ] › ${text}`) + '\n');
      break;
  }
};
