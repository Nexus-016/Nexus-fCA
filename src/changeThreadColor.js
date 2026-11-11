"use strict";

const { generateOfflineThreadingID } = require("../utils");

module.exports = function (defaultFuncs, api, ctx) {
    return function changeThreadColor(color, threadID, callback) {
        let resolveFunc = function () { };
        let rejectFunc = function () { };
        const returnPromise = new Promise(function (resolve, reject) {
            resolveFunc = resolve;
            rejectFunc = reject;
        });

        if (!callback) {
            callback = function (err, data) {
                if (err) {
                    return rejectFunc(err);
                }
                resolveFunc(data);
            };
        }

        if (!ctx.mqttClient) {
            return callback(new Error("MQTT client not connected."));
        }

        // Ensure ctx.wsReqNumber and ctx.wsTaskNumber exist
        ctx.wsReqNumber = ctx.wsReqNumber || 0;
        ctx.wsTaskNumber = ctx.wsTaskNumber || 0;

        let reqID = ++ctx.wsReqNumber;
        
        const content = {
            app_id: "2220391788200892",
            payload: JSON.stringify({
                data_trace_id: null,
                epoch_id: parseInt(generateOfflineThreadingID()),
                tasks: [
                    {
                        failure_count: null,
                        label: "43",
                        payload: JSON.stringify({
                            thread_key: threadID,
                            theme_fbid: color,
                            source: null,
                            sync_group: 1,
                            payload: null
                        }),
                        queue_name: "thread_theme",
                        task_id: ++ctx.wsTaskNumber
                    }
                ],
                version_id: "8798795233522156"
            }),
            request_id: reqID,
            type: 3
        };

        ctx.mqttClient.publish("/ls_req", JSON.stringify(content), {
            qos: 1,
            retain: false
        });

        const handleRes = function (topic, message) {
            if (topic !== "/ls_resp") return;
            let jsonMsg;
            try {
                jsonMsg = JSON.parse(message.toString());
                jsonMsg.payload = JSON.parse(jsonMsg.payload);
            } catch (err) {
                return;
            }
            if (jsonMsg.request_id !== reqID) return;
            ctx.mqttClient.removeListener("message", handleRes);
            try {
                // Check if payload has nested structure as expected by fca-unofficial
                // or if it's simpler. We try to extract like fca-unofficial does.
                const msgID = jsonMsg.payload.step[1][2][2][1][2];
                const msgReplace = jsonMsg.payload.step[1][2][2][1][4];
                const bodies = {
                    body: msgReplace,
                    messageID: msgID
                };
                return callback(null, bodies);
            } catch (err) {
                // If extraction fails, we assume success anyway as long as we got a response matching ID
                return callback(null, { success: true });
            }
        };

        ctx.mqttClient.on("message", handleRes);
        return returnPromise;
    };
};
