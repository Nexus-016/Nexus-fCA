// Nexus-FCA: Advanced and Safe Facebook Chat API
// getOptions.js - Get global options

module.exports = function (defaultFuncs, api, ctx) {
  return (str) => ctx.globalOptions[str];
};
