// Nexus-FCA: Advanced and Safe Facebook Chat API
// sendComment.js - Send a comment to a Facebook post

const utils = require("../utils");
const log = require("npmlog");
const bluebird = require("bluebird");

module.exports = function (defaultFuncs, api, ctx) {
  function getGUID() {
    let _0x161e32 = Date.now(),
      _0x4ec135 = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
        /[xy]/g,
        function (_0x32f946) {
          let _0x141041 = Math.floor((_0x161e32 + Math.random() * 16) % 16);
          _0x161e32 = Math.floor(_0x161e32 / 16);
          let _0x31fcdd = (
            _0x32f946 == "x" ? _0x141041 : (_0x141041 & 0x3) | 0x8
          ).toString(16);
          return _0x31fcdd;
        },
      );
    return _0x4ec135;
  }

  function uploadAttachment(attachment, callback) {
    const uploads = [];
    if (!utils.isReadableStream(attachment)) {
      throw {
        error:
          "Attachment should be a readable stream and not " +
          utils.getType(attachment) +
          ".",
      };
    }
    const form = {
      file: attachment,
      av: api.getCurrentUserID(),
      profile_id: api.getCurrentUserID(),
      source: "19",
      target_id: api.getCurrentUserID(),
      __user: api.getCurrentUserID(),
      __a: "1",
    };
    uploads.push(
      defaultFuncs
        .postFormData(
          "https://www.facebook.com/ajax/ufi/upload",
          ctx.jar,
          form
        )
        .then(utils.parseAndCheckLogin(ctx, defaultFuncs))
        .then(function (res) {
          if (res.error || res.errors || !res.payload) throw res;
          return res.payload.fbid;
        })
    );
    return bluebird.all(uploads);
  }

  return function sendComment(postID, message, callback) {
    // ...existing code from ws3-fca-main (DEMO CODE)/src/sendComment.js...
  };
};
