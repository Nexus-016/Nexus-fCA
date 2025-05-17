// Nexus-FCA: Advanced and Safe Facebook Chat API
// getThreadInfoDeprecated.js - Deprecated thread info fetch

const utils = require("../utils");

module.exports = function(defaultFuncs, api, ctx) {
  return function getThreadInfo(threadID, callback) {
    let resolveFunc = function(){};
    let rejectFunc = function(){};
    const returnPromise = new Promise(function (resolve, reject) {
      resolveFunc = resolve;
      rejectFunc = reject;
    });

    if (!callback) {
      callback = function (err, friendList) {
        if (err) {
          return rejectFunc(err);
        }
        resolveFunc(friendList);
      };
    }

    const form = {
      client: "mercury"
    };

    api.getUserInfo(threadID, function(err, userRes) {
      if (err) {
        return callback(err);
      }
      const key = Object.keys(userRes).length > 0 ? "user_ids" : "thread_fbids";
      form["threads[" + key + "][0]"] = threadID;

      if (ctx.globalOptions.pageId)
        form.request_user_id = ctx.globalOptions.pageId;

      defaultFuncs
        .post(
          "https://www.facebook.com/ajax/mercury/thread_info.php",
          ctx.jar,
          form
        )
        .then(utils.parseAndCheckLogin(ctx, defaultFuncs))
        // ...existing code...
    });
    return returnPromise;
  };
};
