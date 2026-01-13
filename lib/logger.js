const chalk = require('chalk');
const gradient = require('gradient-string');

const infoGradient = gradient(['#00c6ff', '#0072ff']); // blue-cyan gradient
const warnColor = chalk.yellow.bold;
const errorColor = chalk.red.bold;

module.exports = (text, type) => {
  switch (type) {
    case "warn":
      process.stderr.write(warnColor(`\r[ WARN ] › ${text}`) + '\n');
      break;
    case "error":
      process.stderr.write(errorColor(`\r[ ERROR ] › ${text}`) + '\n');
      break;
    case "info":
      process.stderr.write(infoGradient(`\r[ Nexus-FCA ] › ${text}`) + '\n');
      break;
    default:
      process.stderr.write(infoGradient(`\r[ Nexus-FCA ] › ${text}`) + '\n');
      break;
  }
};