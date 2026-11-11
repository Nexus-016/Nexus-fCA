/**
 * ===========================================================
 * Nexus-fCA story-seen API.
 * Added in Nexus-fCA 4.1.0.
 * Adaptations for Nexus ctx: no fb_dtsg_ag/req_ID fields here,
 * so fall back to safe defaults; jazoest uses ctx.ttstamp;
 * lsd uses ctx.lsd (fixed) with fb_dtsg fallback.
 * ===========================================================
 */
'use strict';

var utils = require('../utils.js');
var log = require('npmlog');

module.exports = function(defaultFuncs, api, ctx) {
  return function setStorySeen(storyID, callback) {
    var resolveFunc = function () { };
    var rejectFunc = function () { };
    var returnPromise = new Promise(function (resolve, reject) {
      resolveFunc = resolve;
      rejectFunc = reject;
    });

    if (!callback) {
      callback = function (err, data) {
        if (err) return rejectFunc(err);
        resolveFunc(data);
      };
    }

    if (!storyID) {
      return callback({ error: "storyID is required" });
    }

    var bucketID = storyID;
    if (typeof storyID === 'string' && storyID.includes(':')) {
      try {
        var decoded = Buffer.from(storyID, 'base64').toString('utf-8');
        var match = decoded.match(/(\d+)/);
        if (match) {
          bucketID = match[1];
        }
      } catch (e) {
        bucketID = storyID;
      }
    }

    var form = {
      av: ctx.userID,
      __aaid: 0,
      __user: ctx.userID,
      __a: 1,
      __req: utils.getSignatureID(),
      __hs: ctx.fb_dtsg_ag || "",
      dpr: 1,
      __ccg: "EXCELLENT",
      __rev: ctx.req_ID || "1027694919",
      __s: utils.getSignatureID(),
      __hsi: ctx.hsi || "",
      __comet_req: 15,
      fb_dtsg: ctx.fb_dtsg,
      jazoest: ctx.ttstamp,
      lsd: ctx.lsd || ctx.fb_dtsg,
      __spin_r: ctx.req_ID || "1027694919",
      __spin_b: "trunk",
      __spin_t: Date.now(),
      fb_api_caller_class: "RelayModern",
      fb_api_req_friendly_name: "storiesUpdateSeenStateMutation",
      variables: JSON.stringify({
        input: {
          bucket_id: bucketID,
          story_id: storyID,
          actor_id: ctx.userID,
          client_mutation_id: String(Math.floor(Math.random() * 16) + 1)
        },
        scale: 1
      }),
      server_timestamps: true,
      doc_id: "9567413276713742"
    };

    defaultFuncs
      .post("https://www.facebook.com/api/graphql/", ctx.jar, form)
      .then(utils.parseAndCheckLogin(ctx, defaultFuncs))
      .then(function (resData) {
        if (resData.error) throw resData;

        return callback(null, {
          success: true,
          story_id: storyID,
          bucket_id: bucketID,
          seen_time: Date.now(),
          response: resData
        });
      })
      .catch(function (err) {
        log.error("setStorySeen", err);
        return callback(err);
      });

    return returnPromise;
  };
};
