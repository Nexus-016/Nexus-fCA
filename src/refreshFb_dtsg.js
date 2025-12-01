"use strict";

const utils = require("../utils");
const log = require("npmlog");

module.exports = function (defaultFuncs, api, ctx) {
  return function refreshFb_dtsg(obj, callback) {
    let resolveFunc, rejectFunc;
    const returnPromise = new Promise((resolve, reject) => {
      resolveFunc = resolve;
      rejectFunc = reject;
    });
    if (
      utils.getType(obj) === "Function" ||
      utils.getType(obj) === "AsyncFunction"
    ) {
      callback = obj;
      obj = {};
    }
    if (!obj) obj = {};
    if (utils.getType(obj) !== "Object") {
      throw new utils.CustomError(
        "The first parameter must be an object or a callback function"
      );
    }
    if (!callback) {
      callback = (err, data) => (err ? rejectFunc(err) : resolveFunc(data));
    }
    if (Object.keys(obj).length === 0) {
      const sources = [
        { url: "https://www.facebook.com/", label: "facebook.com" },
        { url: "https://business.facebook.com/", label: "business.facebook.com" },
        { url: "https://mbasic.facebook.com/", label: "mbasic.facebook.com" }
      ];

      const tryRefresh = async () => {
        let lastErr = null;
        for (const source of sources) {
          try {
            const resData = await utils.get(source.url, ctx.jar, null, ctx.globalOptions, { noRef: true });
            const tokens = extractTokensFromHtml(resData.body);
            if (tokens.fb_dtsg) {
              ctx.fb_dtsg = tokens.fb_dtsg;
              if (tokens.jazoest) ctx.jazoest = tokens.jazoest;
              return {
                data: { fb_dtsg: ctx.fb_dtsg, jazoest: ctx.jazoest },
                message: `Refreshed fb_dtsg via ${source.label}`
              };
            }
            lastErr = new utils.CustomError(`Could not find fb_dtsg in HTML from ${source.label}`);
          } catch (err) {
            lastErr = err;
            log.verbose("refreshFb_dtsg", `Fetch from ${source.url} failed: ${err.message}`);
          }
        }
        throw lastErr || new utils.CustomError("Could not find fb_dtsg in any fallback HTML sources.");
      };

      (async () => {
        try {
          const result = await tryRefresh();
          callback(null, result);
        } catch (err) {
          log.error("refreshFb_dtsg", err);
          callback(err);
        }
      })();
    } else {
      Object.assign(ctx, obj);
      callback(null, {
        data: obj,
        message: "Refreshed " + Object.keys(obj).join(", "),
      });
    }
    return returnPromise;
  };
};

function extractTokensFromHtml(html) {
  const tokens = { fb_dtsg: null, jazoest: null };

  const dtsgRegexes = [
    /DTSGInitialData.*?token":"(.*?)"/,
    /"DTSGInitData",\[\],{"token":"(.*?)"/,
    /\["DTSGInitData",\[\],{"token":"(.*?)"/,
    /name="fb_dtsg" value="(.*?)"/,
    /name="dtsg_ag" value="(.*?)"/
  ];

  for (const regex of dtsgRegexes) {
    const match = html.match(regex);
    if (match && match[1]) {
      tokens.fb_dtsg = match[1];
      break;
    }
  }

  if (!tokens.fb_dtsg) {
    try {
      const scriptRegex = /<script type="application\/json"[^>]*>(.*?)<\/script>/g;
      let match;
      const netData = [];
      while ((match = scriptRegex.exec(html)) !== null) {
        try {
          netData.push(JSON.parse(match[1]));
        } catch (_) {}
      }
      const findConfig = (key) => {
        for (const scriptData of netData) {
          if (scriptData.require) {
            for (const req of scriptData.require) {
              if (Array.isArray(req) && req[0] === key && req[2]) {
                return req[2];
              }
              if (
                Array.isArray(req) &&
                req[3] &&
                req[3][0] &&
                req[3][0].__bbox &&
                req[3][0].__bbox.define
              ) {
                for (const def of req[3][0].__bbox.define) {
                  if (Array.isArray(def) && def[0].endsWith(key) && def[2]) {
                    return def[2];
                  }
                }
              }
            }
          }
        }
        return null;
      };
      const dtsgData = findConfig("DTSGInitialData");
      if (dtsgData && dtsgData.token) {
        tokens.fb_dtsg = dtsgData.token;
      }
    } catch (_) {}
  }

  if (!tokens.jazoest) {
    const jazoRegexes = [
      /name="jazoest" value="(\d+)"/,
      /"jazoest","(\d+)"/,
      /jazoest=(\d+)/
    ];
    for (const regex of jazoRegexes) {
      const match = html.match(regex);
      if (match && match[1]) {
        tokens.jazoest = match[1];
        break;
      }
    }
  }

  return tokens;
}