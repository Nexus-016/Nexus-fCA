// Nexus-FCA: Advanced and Safe Facebook Chat API
// getCtx.js - Get context property

module.exports = function (defaultFuncs, api, ctx) {
  return (str) => ctx[str];
};
