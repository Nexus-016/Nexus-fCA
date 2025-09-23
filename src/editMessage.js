// Nexus-FCA: Advanced and Safe Facebook Chat API
// editMessage.js - Edit a sent message via MQTT with PendingEdits buffer & safe resend

const { generateOfflineThreadingID } = require('../utils');

module.exports = function (defaultFuncs, api, ctx) {
  return function editMessage(text, messageID, callback) {
    let promise;
    if (typeof callback !== 'function') {
      promise = new Promise((resolve, reject) => {
        callback = (err, data) => (err ? reject(err) : resolve(data));
      });
    }
    callback = callback || function(){};
    if (!ctx.mqttClient) {
      return callback(new Error('Not connected to MQTT'));
    }
    if(!messageID || typeof text !== 'string') {
      return callback(new Error('Invalid arguments for editMessage'));
    }
    // Safety: manage pending edits buffer with cap & TTL
    const settings = ctx.globalOptions.editSettings || { maxPendingEdits:200, editTTLms:300000, ackTimeoutMs:12000, maxResendAttempts:2 };
    // Drop oldest if capacity reached
    if(ctx.pendingEdits.size >= settings.maxPendingEdits){
      const firstKey = ctx.pendingEdits.keys().next().value;
      if(firstKey){ ctx.pendingEdits.delete(firstKey); if(ctx.health) ctx.health.incPendingEditDropped(); }
    }
    const now = Date.now();
    ctx.pendingEdits.set(messageID, { text, ts: now, attempts: 0 });
    if(ctx.health) ctx.health.addPendingEdit(messageID, text);

    ctx.wsReqNumber += 1;
    ctx.wsTaskNumber += 1;

    const queryPayload = { message_id: messageID, text };    
    const query = { failure_count: null, label: '742', payload: JSON.stringify(queryPayload), queue_name: 'edit_message', task_id: ctx.wsTaskNumber };
    const context = { app_id: '2220391788200892', payload: JSON.stringify({ data_trace_id: null, epoch_id: parseInt(generateOfflineThreadingID()), tasks: [query], version_id: '6903494529735864' }), request_id: ctx.wsReqNumber, type: 3 };

    try {
      ctx.mqttClient.publish('/ls_req', JSON.stringify(context), { qos:1, retain:false }, (err)=>{
        if(err){
          if(ctx.health) ctx.health.onError('edit_publish_fail');
          return callback(err);
        }
        // Schedule ACK / resend watchdog
        scheduleEditAckWatch(messageID, settings, ctx, api, callback);
        callback(null, { queued:true, messageID });
      });
    } catch (e) {
      if(ctx.health) ctx.health.onError('edit_exception');
      return callback(e);
    }
    return promise;
  };
};

function scheduleEditAckWatch(messageID, settings, ctx, api, originalCb){
  if(!settings || !ctx) return;
  const { ackTimeoutMs=12000, maxResendAttempts=2, editTTLms=300000 } = settings;
  setTimeout(()=>{
    const rec = ctx.pendingEdits.get(messageID);
    if(!rec) return; // already acked or removed
    const age = Date.now() - rec.ts;
    if(age > editTTLms){
      ctx.pendingEdits.delete(messageID);
      if(ctx.health){ ctx.health.removePendingEdit(messageID); ctx.health.incPendingEditExpired(); }
      return;
    }
    if(rec.attempts >= maxResendAttempts){
      ctx.pendingEdits.delete(messageID);
      if(ctx.health) ctx.health.markEditFailed(messageID);
      return;
    }
    // Resend
    try {
      rec.attempts++;
      if(ctx.health) ctx.health.markEditResent(messageID);
      const queryPayload = { message_id: messageID, text: rec.text };
      const resend = { failure_count:null, label:'742', payload: JSON.stringify(queryPayload), queue_name:'edit_message', task_id: ++ctx.wsTaskNumber };
      const context = { app_id: '2220391788200892', payload: JSON.stringify({ data_trace_id:null, epoch_id: parseInt(generateOfflineThreadingID()), tasks:[resend], version_id:'6903494529735864' }), request_id: ++ctx.wsReqNumber, type:3 };
      ctx.mqttClient.publish('/ls_req', JSON.stringify(context), { qos:1, retain:false });
      // Chain another watch if still pending
      scheduleEditAckWatch(messageID, settings, ctx, api, originalCb);
    } catch(e){
      if(ctx.health) ctx.health.onError('edit_resend_exception');
    }
  }, ackTimeoutMs);
}
