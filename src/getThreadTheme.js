/**
 * ===========================================================
 * Nexus-fCA thread theme API.
 * Added in Nexus-fCA 4.1.0.
 * Only adaptation: lsd now uses ctx.lsd (fixed) with fb_dtsg fallback.
 * Usage: api.getThreadTheme(themeID, callback) -> { id, name, colors, ... }
 * ===========================================================
 */
"use strict";

const utils = require("../utils");
const log = require("npmlog");

module.exports = function (defaultFuncs, api, ctx) {
  return function getThreadTheme(themeID, callback) {
    let resolveFunc, rejectFunc;
    const returnPromise = new Promise((resolve, reject) => {
      resolveFunc = resolve;
      rejectFunc = reject;
    });

    if (!callback) {
      callback = function (err, data) {
        if (err) return rejectFunc(err);
        resolveFunc(data);
      };
    }

    if (!themeID) {
      return callback({ error: "themeID is required" });
    }

    const form = {
      av: ctx.userID,
      __user: ctx.userID,
      __a: 1,
      __req: utils.getSignatureID(),
      fb_dtsg: ctx.fb_dtsg,
      jazoest: ctx.ttstamp,
      lsd: ctx.lsd || ctx.fb_dtsg,
      fb_api_caller_class: "RelayModern",
      fb_api_req_friendly_name: "MWPThreadThemeProviderQuery",
      variables: JSON.stringify({
        id: themeID.toString()
      }),
      server_timestamps: true,
      doc_id: "9734829906576883"
    };

    defaultFuncs
      .post("https://www.facebook.com/api/graphql/", ctx.jar, form)
      .then(utils.parseAndCheckLogin(ctx, defaultFuncs))
      .then(function (resData) {
        if (resData.errors) throw resData.errors;

        if (resData.data && resData.data.messenger_thread_theme) {
          const themeData = resData.data.messenger_thread_theme;
          return callback(null, {
            id: themeData.id,
            name: themeData.accessibility_label,
            description: themeData.description,
            colors: themeData.gradient_colors || [themeData.fallback_color],
            backgroundImage: themeData.background_asset
              ? themeData.background_asset.image.uri
              : null
          });
        } else {
          throw new Error("No theme data found");
        }
      })
      .catch(function (err) {
        log.error("getThreadTheme", err);
        return callback(err);
      });

    return returnPromise;
  };
};
