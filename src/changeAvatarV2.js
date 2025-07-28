// Nexus-FCA: Advanced and Safe Facebook Chat API
// changeAvatarV2.js - Change user avatar with advanced options

const { rateLimiter, safeMode, isUserAllowed } = require('../utils');

/**
 * Change the user's Facebook avatar with advanced safety checks.
 * @param {Object} defaultFuncs - Default functions from Nexus-FCA context
 * @param {Object} api - Nexus-FCA API object
 * @param {Object} ctx - Nexus-FCA context
 * @returns {Function}
 */
module.exports = function changeAvatarV2(defaultFuncs, api, ctx) {
  /**
   * Change avatar with file stream or URL, with validation and rate limiting.
   * @param {Object} options - { stream, url }
   * @param {Function} callback
   */
  const lastChange = { time: 0 };
  return function(options, callback) {
    // Extract userID from context (for rate limiting and allow/block list)
    const userID = ctx.userID || (ctx.globalOptions && ctx.globalOptions.userID) || 'unknown';

    // Safe mode disables avatar change
    if (safeMode) {
      return callback(new Error("Avatar change is disabled in Nexus-FCA safe mode."));
    }
    // Allow/block list check
    if (!isUserAllowed(userID)) {
      return callback(new Error("You are not allowed to change the avatar."));
    }
    // Rate limiting REMOVED for maximum safety
    // Users can change avatar freely without artificial restrictions

    // Safety: Only allow change every 5 minutes
    const now = Date.now();
    if (now - lastChange.time < 5 * 60 * 1000) {
      return callback(new Error("Avatar can only be changed every 5 minutes for safety."));
    }
    lastChange.time = now;

    // Input validation
    if (!options || (!options.stream && !options.url)) {
      return callback(new Error("You must provide a file stream or image URL."));
    }
    if (options.url && !/^https?:\/\//.test(options.url)) {
      return callback(new Error("Invalid image URL."));
    }

    // Prepare form data
    const form = {};
    if (options.stream) {
      form.file = options.stream;
    } else if (options.url) {
      form.url = options.url;
    }

    // Use the existing postFormData util for upload
    defaultFuncs.postFormData(
      "https://www.facebook.com/profile/picture/upload/",
      ctx.jar,
      form
    )
      .then(res => {
        if (res.statusCode === 200) {
          callback(null, { success: true, message: "Avatar changed successfully." });
        } else {
          callback(new Error("Failed to change avatar. Status: " + res.statusCode));
        }
      })
      .catch(err => {
        callback(new Error("Avatar change failed: " + err.message));
      });
  };
};
