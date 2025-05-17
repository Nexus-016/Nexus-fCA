// Nexus-FCA: Advanced and Safe Facebook Chat API
// getThreadHistoryDeprecated.js - Deprecated thread history fetch

const utils = require("../utils");

module.exports = function(defaultFuncs, api, ctx) {
  return function getThreadHistory(threadID, amount, timestamp, callback) {
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

    if (!callback) {
      throw { error: "getThreadHistory: need callback" };
    }

    const form = {
      client: "mercury"
    };

    api.getUserInfo(threadID, function(err, res) {
      if (err) {
        return callback(err);
      }
      const key = Object.keys(res).length > 0 ? "user_ids" : "thread_fbids";
      form["messages[" + key + "][" + threadID + "][offset]"] = 0;
      form["messages[" + key + "][" + threadID + "][timestamp]"] = timestamp;
      form["messages[" + key + "][" + threadID + "][limit]"] = amount;

      if (ctx.globalOptions.pageID)
        form.request_user_id = ctx.globalOptions.pageID;

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
