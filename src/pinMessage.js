// Nexus-FCA: Advanced and Safe Facebook Chat API
// pinMessage.js - Pin or unpin a message in a group chat

const { generateOfflineThreadingID } = require('../utils');

function isCallable(func) {
  return typeof func === 'function';
}

module.exports = function (defaultFuncs, api, ctx) {
  return function pinMessage(pinMode, messageID, threadID, callback) {
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

    const taskLabel = pinMode ? '430' : '431';
    const queueNamePrefix = pinMode ? 'pin_msg_v2_' : 'unpin_msg_v2_';

    const taskPayload = {
      thread_key: threadID,
      message_id: messageID,
      timestamp_ms: Date.now(),
    };

    const task = {
      failure_count: null,
      label: taskLabel,
      payload: JSON.stringify(taskPayload),
      queue_name: `${queueNamePrefix}${threadID}`,
      task_id: ctx.wsTaskNumber,
    };

    const content = {
      app_id: '2220391788200892',
      payload: JSON.stringify({
        data_trace_id: null,
        epoch_id: parseInt(generateOfflineThreadingID()),
        tasks: [task],
        version_id: '25095469420099952',
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
