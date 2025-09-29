// Nexus-FCA: Advanced and Safe Facebook Chat API
// changeBlockedStatusMqtt.js - Block/unblock users via MQTT

const { generateOfflineThreadingID, getCurrentTimestamp, getGUID } = require('../utils.js');

function isCallable(func) {
  return typeof func === 'function';
}

module.exports = function (defaultFuncs, api, ctx) {
  return function changeBlockedStatusMqtt(userID, status, type, callback) {
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

    const label = '334';
    let userBlockAction = 0;

    switch (type) {
      case 'messenger':
        userBlockAction = status ? 1 : 0;
        break;
      case 'facebook':
        userBlockAction = status ? 3 : 2;
        break;
      default:
        throw new Error('Invalid type');
    }

    const taskPayload = {
      blockee_id: userID,
      request_id: getGUID(),
      user_block_action: userBlockAction,
    };
    const payload = JSON.stringify(taskPayload);
    const version = '25393437286970779';

    const task = {
      failure_count: null,
      label: label,
      payload: payload,
      queue_name: 'native_sync_block',
      task_id: ctx.wsTaskNumber,
    };

    const content = {
      app_id: '2220391788200892',
      payload: JSON.stringify({
        tasks: [task],
        epoch_id: parseInt(generateOfflineThreadingID()),
        version_id: version,
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
