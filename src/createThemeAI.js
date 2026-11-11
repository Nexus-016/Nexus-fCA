"use strict";

const log = require("npmlog");
const utils = require("../utils");

module.exports = function (defaultFuncs, api, ctx) {
  return function createAITheme(prompt, numThemes, callback) {
    // createAITheme(prompt, numThemes?, callback) - up to 10 themes
    if (typeof numThemes === "function") {
      callback = numThemes;
      numThemes = 1;
    }
    if (typeof numThemes !== "number" || numThemes < 1) numThemes = 1;
    if (numThemes > 10) numThemes = 10;
    let resolveFunc = function () { };
    let rejectFunc = function () { };
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

    if (utils.getType(prompt) !== "String") {
      return callback({ error: "Invalid prompt. Please provide a string." });
    }

    if (!prompt || prompt.trim().length === 0) {
      return callback({ error: "Prompt cannot be empty." });
    }

    const form = {
      av: ctx.i_userID || ctx.userID,
      qpl_active_flow_ids: "25308101,25309433,521482085",
      fb_api_caller_class: "RelayModern",
      fb_api_req_friendly_name: "useGenerateAIThemeMutation",
      variables: JSON.stringify({
        input: {
          client_mutation_id: "1",
          actor_id: ctx.i_userID || ctx.userID,
          bypass_cache: true,
          caller: "MESSENGER",
          num_themes: numThemes,
          prompt: prompt.trim()
        }
      }),
      server_timestamps: true,
      doc_id: "23873748445608673",
      fb_api_analytics_tags: JSON.stringify([
        "qpl_active_flow_ids=25308101,25309433,521482085"
      ]),
      fb_dtsg: ctx.fb_dtsg
    };

    // NOTE (Oct 2026 fix): AI generation only resolves on web.facebook.com.
    // www.facebook.com returns field_exception 1675030 with null data.
    // Retry policy: FB AI often fails on multi-theme requests when busy -
    // first try requested count, on field_exception retry once with num_themes=1.
    const attempt = (count, delayMs) => new Promise((resolveAttempt, rejectAttempt) => {
      const tryNow = () => {
        const attemptForm = {
          ...form,
          variables: JSON.stringify({
            input: {
              client_mutation_id: String(Math.floor(Math.random() * 1000000)),
              actor_id: ctx.i_userID || ctx.userID,
              bypass_cache: true,
              caller: "MESSENGER",
              num_themes: count,
              prompt: prompt.trim()
            }
          })
        };
        defaultFuncs
          .post("https://web.facebook.com/api/graphql/", ctx.jar, attemptForm)
          .then(utils.parseAndCheckLogin(ctx, defaultFuncs))
          .then(resolveAttempt)
          .catch(rejectAttempt);
      };
      if (delayMs > 0) setTimeout(tryNow, delayMs);
      else tryNow();
    });

    attempt(numThemes, 0)
      .then(function (resData) {
        if (resData.errors && numThemes > 1) {
          // multi-theme failed -> one last light retry with a single theme
          log.warn("createThemeAI", "Multi-theme failed, retrying with num_themes=1...");
          return attempt(1, 5000);
        }
        return resData;
      })
      .then(function (resData) {
        // Debug: only log error shape, never the full response (floods console)
        if (resData.errors) {
          log.warn("createThemeAI", "GraphQL errors: " + JSON.stringify(resData.errors).slice(0, 500));
          const coded = new Error("FIELD_EXCEPTION_1675030");
          coded.resData = resData;
          throw coded;
        }

        if (!resData.data || !resData.data.xfb_generate_ai_themes_from_prompt) {
          throw {
            error: "Invalid response from Facebook API",
            res: JSON.stringify(resData, null, 2)
          };
        }

        const themes = resData.data.xfb_generate_ai_themes_from_prompt.themes;
        if (!themes || !Array.isArray(themes) || themes.length === 0) {
          throw {
            error: "No themes generated",
            res: JSON.stringify(resData, null, 2)
          };
        }

        const theme = themes[0];
        if (!theme || !theme.id || !theme.background_asset) {
          throw {
            error: "Invalid theme data",
            res: JSON.stringify(resData, null, 2)
          };
        }

        const extractUrl = (obj) => {
          if (!obj) return null;
          if (typeof obj === "string") return obj;
          return obj.uri || obj.url || null;
        };

        // Keep full theme data (colors, preview urls) so callers can tell
        // variants apart - AI variants often share the same label.
        const normalizeTheme = (t) => {
          const out = { ...t };
          let preview = t.preview_image_urls || t.preview_images || t.preview_urls || null;
          if (preview) {
            if (typeof preview === "string") preview = { light_mode: preview, dark_mode: preview };
            else if (Array.isArray(preview)) preview = { light_mode: extractUrl(preview[0]), dark_mode: extractUrl(preview[1]) || extractUrl(preview[0]) };
            else preview = { light_mode: extractUrl(preview.light_mode) || extractUrl(preview.light), dark_mode: extractUrl(preview.dark_mode) || extractUrl(preview.dark) };
            out.preview_image_urls = preview;
          } else if (t.background_asset?.image) {
            const u = extractUrl(t.background_asset.image);
            if (u) out.preview_image_urls = { light_mode: u, dark_mode: u };
          }
          return out;
        };

        callback(null, {
          id: theme.id,
          accessibility_label: theme.accessibility_label || null,
          background_asset: {
            id: theme.background_asset.id,
            image: {
              url: theme.background_asset.image?.uri || null
            }
          },
          // all generated themes when numThemes > 1 (full data kept)
          allThemes: themes.filter(t => t && t.id).map(normalizeTheme)
        });
      })
      .catch(function (err) {
        // Keep console clean: short message here, full err goes to the caller
        const shortMsg = err && err.message ? err.message : (err && err.error ? String(err.error).slice(0, 200) : "unknown error");
        log.error("createThemeAI", shortMsg);
        return callback(err);
      });

    return returnPromise;
  };
};
