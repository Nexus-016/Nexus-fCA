// Nexus-FCA: Advanced and Safe Facebook Chat API
// getThreadListDeprecated.js - Deprecated thread list fetch

const utils = require("../utils");

module.exports = function(defaultFuncs, api, ctx) {
  return function getThreadList(start, end, type, callback) {
    if (utils.getType(callback) === "Undefined") {
      if (utils.getType(end) !== "Number") {
        throw {
          error: "Please pass a number as a second argument."
        };
      } else if (
        utils.getType(type) === "Function" ||
        utils.getType(type) === "AsyncFunction"
      ) {
        callback = type;
        type = "inbox"; //default to inbox
      } else if (utils.getType(type) !== "String") {
        throw {
          error:
            "Please pass a String as a third argument. Your options are: inbox, pending, and archived"
        };
      } else {
        throw {
          error: "getThreadList: need callback"
        };
      }
    }

    if (type === "archived") {
      type = "action:archived";
    } else if (type !== "inbox" && type !== "pending" && type !== "other") {
      throw {
        error:
          "type can only be one of the following: inbox, pending, archived, other"
      };
    }

    if (end <= start) end = start + 20;

    const form = {
      client: "mercury"
    };

    form[type + "[offset]"] = start;
    form[type + "[limit]"] = end - start;

    if (ctx.globalOptions.pageID) {
      form.request_user_id = ctx.globalOptions.pageID;
    }
    // ...existing code...
  };
};
