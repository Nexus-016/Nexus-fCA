"use strict";

var log = require("npmlog");

/**
 * Nexus-fCA 4.1.1 — sendTypingIndicator (FIXED)
 *
 * Problem: old version used dead HTTP endpoint
 *   POST https://www.facebook.com/ajax/messaging/typ.php (mercury-chat)
 * which Facebook removed years ago -> typing never showed.
 *
 * Fix (from toru-fca v1.1.0, E2EE part omitted - Nexus has no E2EE bridge):
 * publish MQTT /ls_req type-4 label-3 task with shared ctx.wsReqNumber
 * so request_id stays unique across all MQTT calls.
 *
 * Dual signature (both work):
 *   NEW: api.sendTypingIndicator(true, threadID, callback)
 *   OLD: api.sendTypingIndicator(threadID, callback)  // typing=true + returns end()
 */

function publishTyping(ctx, sendTyping, threadID, callback) {
  // E2EE route (toru-fca pattern): E2EE thread typing goes through the bridge
  if (ctx.globalOptions && ctx.globalOptions.enableE2EE) {
    try {
      var _e2eeMod = require("../e2ee");
      if (_e2eeMod.isE2EEChatJid(String(threadID))) {
        _e2eeMod.createBridge(ctx).sendTyping(String(threadID), sendTyping !== false)
          .then(function (r) { if (typeof callback === "function") callback(null, r); })
          .catch(function () { if (typeof callback === "function") callback(null); });
        return Promise.resolve(null);
      }
    } catch (_) { /* fall through to normal path */ }
  }
  var mqttClient = ctx.mqttClient || global.mqttClient;
  if (!mqttClient || !mqttClient.connected) {
    // Non-fatal: typing indicator is cosmetic - skip silently when MQTT is not up
    if (typeof callback === "function") callback(null);
    return Promise.resolve(null);
  }

  // Shared counter so request_id is unique across all ls_req calls
  ctx.wsReqNumber = (ctx.wsReqNumber || 0) + 1;
  var count_req = ctx.wsReqNumber;

  var wsContent = {
    app_id: 2220391788200892,
    payload: JSON.stringify({
      label: 3,
      payload: JSON.stringify({
        thread_key: threadID.toString(),
        is_group_thread: +(threadID.toString().length >= 16),
        is_typing: sendTyping ? 1 : 0,
        attribution: 0
      }),
      version: 5849951561777440
    }),
    request_id: count_req,
    type: 4
  };

  return new Promise(function (resolve, reject) {
    mqttClient.publish("/ls_req", JSON.stringify(wsContent), {}, function (err, packet) {
      if (err) {
        log.warn("sendTypingIndicator", "Publish failed: " + (err.message || err));
        if (typeof callback === "function") callback(err);
        reject(err);
      } else {
        if (typeof callback === "function") callback(null, packet);
        resolve(packet);
      }
    });
  });
}

function normalizeCallback(callback) {
  if (typeof callback === "function") return callback;
  if (callback) {
    log.warn("sendTypingIndicator", "callback is not a function - ignoring.");
  }
  return function () {};
}

module.exports = function (defaultFuncs, api, ctx) {
  return function sendTypingIndicator(sendTypingOrThreadID, threadIDOrCallback, callbackOrIsGroup) {
    var sendTyping, threadID, callback;

    // OLD style: (threadID, callback, isGroup?) - first arg is thread id
    if (
      typeof sendTypingOrThreadID === "string" ||
      typeof sendTypingOrThreadID === "number"
    ) {
      sendTyping = true;
      threadID = sendTypingOrThreadID;
      callback = normalizeCallback(threadIDOrCallback);
    } else {
      // NEW style: (sendTypingBool, threadID, callback)
      sendTyping = sendTypingOrThreadID !== false;
      threadID = threadIDOrCallback;
      callback = normalizeCallback(callbackOrIsGroup);
    }

    if (!threadID) {
      var err = new Error("threadID is required");
      callback(err);
      return Promise.reject(err);
    }

    var promise = publishTyping(ctx, sendTyping, threadID, callback);

    // OLD style compat: return end() that stops typing
    if (
      typeof sendTypingOrThreadID === "string" ||
      typeof sendTypingOrThreadID === "number"
    ) {
      return function end(cb) {
        cb = normalizeCallback(cb);
        return publishTyping(ctx, false, threadID, cb);
      };
    }

    return promise;
  };
};
