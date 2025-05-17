// Nexus-FCA: Advanced and Safe Facebook Chat API
// shareLink.js - Share a link in a thread

const utils = require("../utils");

module.exports = function (defaultFuncs, api, ctx) {
  return async function shareLink(text, url, threadID, callback) {
    let resolveFunc = function () {};
    let rejectFunc = function () {};
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
    ctx.mqttClient.publish(
      '/ls_req',
      JSON.stringify({
        "app_id": "2220391788200892",
        "payload": JSON.stringify({
          tasks: [{
            label: 46,
            payload: JSON.stringify({
              "otid": utils.generateOfflineThreadingID(),
              "source": 524289,
              "sync_group": 1,
              "send_type": 6,
              "mark_thread_read": 0,
              "url": url || "https://www.facebook.com/",
              "text": text || "",
              "thread_id": threadID,
              "initiating_source": 0
            }),
            queue_name: threadID,
            task_id: Math.random() * 1001 << 0,
            failure_count: null,
          }],
          epoch_id: utils.generateOfflineThreadingID(),
          version_id: '7191105584331330',
        }),
        "request_id": ++ctx.req_ID,
        "type": 3
      }),
      {
        qos: 1,
        retain: false,
      }
    );
    ctx.callback_Task[ctx.req_ID] = {
      callback,
      type: "shareLink"
    };
    return returnPromise;
  };
};
