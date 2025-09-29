// Nexus-FCA: Advanced and Safe Facebook Chat API
// setMessageReactionMqtt.js - React to messages using MQTT

const { generateOfflineThreadingID } = require('../utils');

function isCallable(func) {
  return typeof func === 'function';
}

module.exports = function (defaultFuncs, api, ctx) {
  return function setMessageReactionMqtt(reaction, messageID, threadID, callback) {
    let cb = callback;
    let promise;
    if (!isCallable(cb)) {
      promise = new Promise((resolve, reject) => {
        cb = (err, data) => (err ? reject(err) : resolve(data));
      });
    }

    if (!ctx.mqttClient) {
      const error = new Error('Not connected to MQTT');
      if (promise) {
        cb(error);
        return promise;
      }
      throw error;
    }

    ctx.wsReqNumber += 1;
    ctx.wsTaskNumber += 1;

    const taskPayload = {
      thread_key: threadID,
      timestamp_ms: Date.now(),
      message_id: messageID,
      reaction: reaction,
      actor_id: ctx.userID,
      reaction_style: null,
      sync_group: 1,
      send_attribution: Math.random() < 0.5 ? 65537 : 524289
    };

    const task = {
      failure_count: null,
      label: '29',
      payload: JSON.stringify(taskPayload),
      queue_name: JSON.stringify(['reaction', messageID]),
      task_id: ctx.wsTaskNumber,
    };

    const content = {
      app_id: '2220391788200892',
      payload: JSON.stringify({
        data_trace_id: null,
        epoch_id: parseInt(generateOfflineThreadingID()),
        tasks: [task],
        version_id: '7158486590867448',
      }),
      request_id: ctx.wsReqNumber,
      type: 3,
    };

    if (!ctx.reqCallbacks) {
      ctx.reqCallbacks = {};
    }

    if (isCallable(cb)) {
      ctx.reqCallbacks[ctx.wsReqNumber] = (err, data) => {
        cb(err, data);
      };
    }

    ctx.mqttClient.publish('/ls_req', JSON.stringify(content), { qos: 1, retain: false }, (err) => {
      if (err && isCallable(cb)) {
        cb(err);
      }
    });

    return promise;
  };
};
