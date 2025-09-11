const chalk = require('chalk');
const gradient = require('gradient-string');

const infoGradient = gradient(['#00c6ff', '#0072ff']); // blue-cyan gradient
const warnColor = chalk.yellow.bold;
const errorColor = chalk.red.bold;

module.exports = (text, type) => {
  switch (type) {
    case "warn":
      process.stderr.write(warnColor(`\r[ NEXUS-FCA WARN ] > ${text}`) + '\n');
      break;
    case "error":
      process.stderr.write(errorColor(`\r[ NEXUS-FCA ERROR ] > ${text}`) + '\n');
      break;
    case "info":
      process.stderr.write(infoGradient(`\r[ NEXUS-FCA ] > ${text}`) + '\n');
      break;
    default:
      process.stderr.write(infoGradient(`\r[ NEXUS-FCA ] > ${text}`) + '\n');
      break;
  }
};