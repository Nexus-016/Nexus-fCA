// Nexus-FCA: Advanced and Safe Facebook Chat API
// editMessage.js - Edit a sent message via MQTT

const { generateOfflineThreadingID } = require('../utils');

function canBeCalled(func) {
  try {
    Reflect.apply(func, null, []);
    return true;
  } catch (error) {
    return false;
  }
}

module.exports = function (defaultFuncs, api, ctx) {
  return function editMessage(text, messageID, callback) {
    if (!ctx.mqttClient) {
      throw new Error('Not connected to MQTT');
    }

    ctx.wsReqNumber += 1;
    ctx.wsTaskNumber += 1;

    const queryPayload = {
      message_id: messageID,
      text: text
    };

    const query = {
      failure_count: null,
      label: '742',
      payload: JSON.stringify(queryPayload),
      queue_name: 'edit_message',
      task_id: ctx.wsTaskNumber
    };

    const context = {
      app_id: '2220391788200892',
      payload: JSON.stringify({
        data_trace_id: null,
        epoch_id: parseInt(generateOfflineThreadingID()),
        tasks: [query],
        version_id: '6903494529735864'
      }),
      request_id: ctx.wsReqNumber,
      type: 3
    };

    // if (canBeCalled(callback)) {
    //   ctx.reqCallbacks[ctx.wsReqNumber] = callback;
    // }

    ctx.mqttClient.publish('/ls_req', JSON.stringify(context), {
      qos: 1, retain: false
    });
  };
};
