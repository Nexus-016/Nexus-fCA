/**
 * ===========================================================
 * Original: toru-fca (merged FCA) - credits to original authors.
 * Ported to Nexus-fCA 4.1.0.
 * Sends CTA/button-style message over MQTT (label 46 task).
 * Usage: api.sendButtons(rearrangedCtaId, text, threadID, [replyToMessageID], callback)
 * ===========================================================
 */
"use strict";

var log = require("npmlog");

const { generateOfflineThreadingID } = require('../utils');

function safeParseInt(value, fallback = 0) {
  const parsed = parseInt(value);
  return isNaN(parsed) ? fallback : parsed;
}

const SHUFFLE_SEED = 42;

function generateShufflePattern(length) {
  const pattern = Array.from({ length }, (_, i) => i);
  let seed = SHUFFLE_SEED;
  for (let i = length - 1; i > 0; i--) {
    seed = (seed * 9301 + 49297) % 233280;
    const j = Math.floor((seed / 233280) * (i + 1));
    [pattern[i], pattern[j]] = [pattern[j], pattern[i]];
  }
  return pattern;
}

function generateReversePattern(shufflePattern) {
  const reversePattern = new Array(shufflePattern.length);
  for (let i = 0; i < shufflePattern.length; i++) {
    reversePattern[shufflePattern[i]] = i;
  }
  return reversePattern;
}

function unrearrange(rearrangedId) {
  try {
    if (!rearrangedId || typeof rearrangedId !== "string") {
      log.error("Unrearrange: Invalid input");
      return null;
    }
    const pattern = generateShufflePattern(rearrangedId.length);
    const reversePattern = generateReversePattern(pattern);
    const original = new Array(rearrangedId.length);
    for (let i = 0; i < rearrangedId.length; i++) {
      original[reversePattern[i]] = rearrangedId[i];
    }
    return original.join("");
  } catch (err) {
    log.error("Unrearrange error:", err.message);
    return null;
  }
}

module.exports = function (defaultFuncs, api, ctx) {
  return function sendButtons(
    call_to_actions,
    text,
    threadID,
    messageID,
    callback,
  ) {
    let resolveFunc = () => {};
    let rejectFunc = () => {};
    const returnPromise = new Promise(function (resolve, reject) {
      resolveFunc = resolve;
      rejectFunc = reject;
    });

    if (!callback) {
      callback = function (err, data) {
        if (err) return rejectFunc(err);
        resolveFunc(data);
      };
    }

    if (!ctx.mqttClient) {
      const err = new Error("Not connected to MQTT");
      callback(err);
      return returnPromise;
    }

    if (!ctx.reqCallbacks) ctx.reqCallbacks = {};
    if (!ctx.callback_Task) ctx.callback_Task = {};

    ctx.wsReqNumber += 1;
    ctx.wsTaskNumber += 1;

    const reqID = ctx.wsReqNumber;
    const cta_id = unrearrange(call_to_actions);

    if (!cta_id) {
      const err = new Error("Failed to unrearrange messageID");
      callback(err);
      return returnPromise;
    }

    const taskPayload = {
      thread_id: threadID,
      otid: safeParseInt(generateOfflineThreadingID()),
      source: 65544,
      send_type: 5,
      sync_group: 1,
      forwarded_msg_id: cta_id,
      strip_forwarded_msg_caption: 1,
      skip_url_preview_gen: 0,
      text: text || "",
      initiating_source: 1,
    };

    if (messageID != undefined && messageID != null) {
      taskPayload.reply_metadata = {
        reply_source_id: messageID,
        reply_source_type: 1,
        reply_type: 0,
      };
    }

    const task = {
      failure_count: null,
      label: "46",
      payload: JSON.stringify(taskPayload),
      queue_name: `${threadID}`,
      task_id: ctx.wsTaskNumber,
    };

    const content = {
      app_id: "2220391788200892",
      payload: JSON.stringify({
        data_trace_id: null,
        epoch_id: safeParseInt(generateOfflineThreadingID()),
        tasks: [task],
        version_id: "24180904141611263",
      }),
      request_id: reqID,
      type: 3,
    };

    ctx.callback_Task[reqID] = {
      type: "call_to_actions",
      callback: function (err, data) {
        if (err) return callback(err);

        const result = {
          messageID: cta_id,
          senderID: ctx.userID,
          threadID: threadID,
          action: "cta_buttons",
        };

        callback(null, result);
      },
    };

    ctx.mqttClient.publish("/ls_req", JSON.stringify(content), {
      qos: 1,
      retain: false,
    });

    return returnPromise;
  };
};
