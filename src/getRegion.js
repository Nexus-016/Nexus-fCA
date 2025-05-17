// Nexus-FCA: Advanced and Safe Facebook Chat API
// getRegion.js - Get server region

module.exports = function (defaultFuncs, api, ctx) {
  return function getRegion() {
    return ctx?.region;
  };
};
