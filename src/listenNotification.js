// Nexus-FCA: Advanced and Safe Facebook Chat API
// listenNotification.js - Listen for Facebook notifications (Upgraded to Realtime)

const utils = require('../utils');
const log = require('npmlog');
const listenRealtime = require('./listenRealtime');

module.exports = function (defaultFuncs, api, ctx) {
  // Initialize the Realtime factory
  const createRealtimeListener = listenRealtime(defaultFuncs, api, ctx);

  return function () {
    let realtimeEmitter = null;

    return {
      start: function (callback) {
        log.info("listenNotification", "Upgraded: Using WebSocket-based Realtime system for notifications.");
        realtimeEmitter = createRealtimeListener((err, data) => {
            // Adapt format if necessary, but listenRealtime already returns compatible "notification" type
            if (callback) callback(err, data);
        });
      },
      stop: function () {
        if (realtimeEmitter) {
            realtimeEmitter.stop();
            realtimeEmitter = null;
        }
      }
    };
  };
};
