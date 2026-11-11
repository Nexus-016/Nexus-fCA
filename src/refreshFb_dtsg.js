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

    if (utils.getType(obj) === "Function" || utils.getType(obj) === "AsyncFunction") {
      callback = obj;
      obj = {};
    }
    if (!obj) obj = {};

    if (!callback) {
      callback = (err, data) => (err ? rejectFunc(err) : resolveFunc(data));
    }

    if (Object.keys(obj).length === 0) {
      // Primary: simple and robust method first
      utils.get("https://www.facebook.com/", ctx.jar, null, ctx.globalOptions, { noRef: true })
        .then(res => {
          const html = res.body;
          // Extraction patterns
          const fb_dtsg = utils.getFrom(html, '["DTSGInitData",[],{"token":"', '","') ||
                          utils.getFrom(html, '"DTSGInitData",[],{"token":"', '","');
          
          const jazoest = utils.getFrom(html, 'jazoest=', '",') ||
                          utils.getFrom(html, 'name="jazoest" value="', '"');
          
          const lsd = utils.getFrom(html, "[\"LSD\",[],{\"token\":\"", "\",");

          if (fb_dtsg) {
            ctx.fb_dtsg = fb_dtsg;
            if (jazoest) ctx.jazoest = jazoest;
            if (lsd) ctx.lsd = lsd;
            
            log.info("refreshFb_dtsg", "✅ Token refreshed via www.facebook.com (primary)");
            callback(null, {
                data: { fb_dtsg: ctx.fb_dtsg, jazoest: ctx.jazoest, lsd: ctx.lsd },
                message: "Refreshed fb_dtsg via www.facebook.com"
            });
          } else {
             // Fallback to legacy loop if primary fails
             return fallbackRefresh(ctx, callback, resolveFunc, rejectFunc);
          }
        })
        .catch(err => {
           log.warn("refreshFb_dtsg", "Primary fetch failed, trying fallbacks...", err);
           fallbackRefresh(ctx, callback, resolveFunc, rejectFunc);
        });
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

// Robust fallback logic
async function fallbackRefresh(ctx, callback, resolve, reject) {
    const sources = [
        { url: "https://www.facebook.com/", label: "facebook.com" },
        { url: "https://mbasic.facebook.com/", label: "mbasic.facebook.com" },
        { url: "https://business.facebook.com/", label: "business.facebook.com" }
    ];

    let lastErr = null;
    for (const source of sources) {
        try {
            const resData = await utils.get(source.url, ctx.jar, null, ctx.globalOptions, { noRef: true });
            const html = resData.body;

             if (html && (html.includes("login_form") || html.includes("/login.php"))) {
                 log.warn("refreshFb_dtsg", `Session expired detected from ${source.label}`);
                 lastErr = new utils.CustomError("Session expired - login required");
                 continue;
             }

            // Try getFrom extraction with various patterns
            let fb_dtsg = utils.getFrom(html, 'name="fb_dtsg" value="', '"') ||
                          utils.getFrom(html, '["DTSGInitData",[],{"token":"', '","') ||
                          utils.getFrom(html, 'DTSGInitialData",[],{"token":"', '","') ||
                          utils.getFrom(html, 'name="dtsg_ag" value="', '"');

            if (fb_dtsg) {
                ctx.fb_dtsg = fb_dtsg;
                log.info("refreshFb_dtsg", `✅ Token refreshed via ${source.label} (fallback)`);
                const result = {
                    data: { fb_dtsg: ctx.fb_dtsg },
                    message: `Refreshed fb_dtsg via ${source.label}`
                };
                callback(null, result);
                return; // Resolved via callback
            }
            lastErr = new utils.CustomError(`Could not find fb_dtsg in HTML from ${source.label}`);

        } catch (err) {
            lastErr = err;
            log.verbose("refreshFb_dtsg", `Fetch from ${source.url} failed: ${err.message}`);
        }
    }

    // Auto-login attempt if all failed
    let autoLoginOk = false;
    if (typeof ctx.performAutoLogin === "function") {
         log.warn("refreshFb_dtsg", "All sources failed. Attempting auto-login recovery...");
         try {
             const loginSuccess = await ctx.performAutoLogin();
             if (loginSuccess) {
                 autoLoginOk = true;
                 log.info("refreshFb_dtsg", "Auto-login reported success. Please retry action.");
                 // In a real scenario we might recurse, but stopping here prevents infinite loops
             }
         } catch(e) {
             log.error("refreshFb_dtsg", "Auto-login failed: " + e.message);
         }
    }

    // NEXUS SELF-HEAL: when the session is truly dead (every source served a
    // login form) and auto-login could not revive it, restart the process so
    // the hosting platform (Koyeb/Railway/Render) re-runs login with the latest
    // cookie-refresher-saved appstate.json instead of leaving a zombie bot.
    const deathMessage = String(lastErr && lastErr.message || "");
    if (!autoLoginOk && /session expired/i.test(deathMessage) && !global.__NEXUS_SESSION_RECOVERY__) {
        global.__NEXUS_SESSION_RECOVERY__ = true;
        log.error("refreshFb_dtsg", "Session expired and auto-login did not recover it. Restarting the bot process in 15 seconds so it can re-login with the latest refreshed appstate.");
        setTimeout(() => process.exit(1), 15000);
    }

    callback(lastErr || new utils.CustomError("Could not find fb_dtsg in any fallback HTML sources."));
}
