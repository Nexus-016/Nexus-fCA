"use strict";

const utils = require("../utils");
const mqtt = require("mqtt");
const WebSocket = require("ws");
const HttpsProxyAgent = require("https-proxy-agent");
const EventEmitter = require("events");

function connectLightspeed(ctx, globalCallback) {
    let client;
    let isStopped = false;
    const region = ctx.region || "PRN";

    function startConnection(retryCount = 0) {
        if (isStopped) return;

        const chatOn = ctx.globalOptions.online;
        const sessionID = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER) + 1;
        const cookies = ctx.jar.getCookiesSync("https://www.facebook.com").join("; ");
        const cid = ctx.clientID;

        const username = {
            u: ctx.userID,
            s: sessionID,
            chat_on: chatOn,
            fg: false,
            d: cid,
            ct: "websocket",
            aid: "2220391788200892", // Messenger Android App ID
            mqtt_sid: "",
            cp: 3,
            ecp: 10,
            st: [],
            pm: [],
            dc: "",
            no_auto_fg: true,
            gas: null,
            pack: [],
            a: ctx.globalOptions.userAgent || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
        };

        // Lightspeed specific headers
        const queryParams = new URLSearchParams({
            "x-dgw-appid": "2220391788200892",
            "x-dgw-appversion": "0",
            "x-dgw-authtype": "1:0",
            "x-dgw-version": "5",
            "x-dgw-uuid": ctx.userID,
            "x-dgw-tier": "prod",
            "x-dgw-loggingid": utils.getGUID(),
            "x-dgw-regionhint": region,
            "x-dgw-deviceid": ctx.clientID
        });

        const host = `wss://gateway.facebook.com/ws/lightspeed?${queryParams.toString()}`;

        const options = {
            clientId: "mqttwsclient",
            protocolId: "MQIsdp",
            protocolVersion: 3,
            username: JSON.stringify(username),
            clean: true,
            keepalive: 10,
            reconnectPeriod: 0, // We handle reconnects manually
            wsOptions: {
                headers: {
                    "Cookie": cookies,
                    "Origin": "https://www.facebook.com",
                    "User-Agent": username.a,
                    "Referer": "https://www.facebook.com/",
                    "Host": "gateway.facebook.com"
                },
                origin: "https://www.facebook.com",
                protocolVersion: 13,
                binaryType: "arraybuffer"
            }
        };

        if (ctx.globalOptions.proxy) {
            options.wsOptions.agent = new HttpsProxyAgent(ctx.globalOptions.proxy);
        }

        // Custom WebSocket stream builder for mqtt.js to support headers
        const streamBuilder = (client) => {
            const ws = new WebSocket(host, options.wsOptions);
            const stream = WebSocket.createWebSocketStream(ws, { encoding: 'binary' });
            stream.url = host;
            return stream;
        };

        try {
            // Use the stream builder if possible, or fallback to standard connection
            // Note: mqtt.js in node uses 'ws' package, we pass options.wsOptions
            client = mqtt.connect(host, options);
            
            // If mqtt.connect doesn't support custom headers in handshake directly in this version,
            // we might need to use the stream builder approach. 
            // For now, we assume standard mqtt.js with wsOptions works.
        } catch (err) {
            console.error("Lightspeed Connection Error:", err);
            reconnect(retryCount + 1);
            return;
        }

        client.on("connect", () => {
            // console.log("Connected to Lightspeed!");
            retryCount = 0;

            // Subscribe to essential topics
            const topics = [
                "/t_ms", 
                "/orca_presence", 
                "/messaging_events", 
                "/webrtc", 
                "/legacy_web"
            ];

            topics.forEach(topic => {
                client.subscribe(topic, (err) => {
                    if (err) console.error(`Failed to subscribe to ${topic}`, err);
                });
            });
        });

        client.on("message", (topic, payload) => {
            try {
                // Record activity for safety monitoring
                if (ctx.globalSafety && typeof ctx.globalSafety.recordEvent === 'function') {
                    ctx.globalSafety.recordEvent();
                }

                // Pass raw payload to callback - parsing logic will be needed
                // For now, we just emit the raw event to show it works
                // In a full implementation, we need to decode the payload (often JSON or Thrift)
                const payloadStr = payload.toString();
                let jsonPayload;
                try {
                    jsonPayload = JSON.parse(payloadStr);
                } catch (e) {
                    // If not JSON, it might be binary/thrift, pass as is
                    jsonPayload = payload;
                }

                globalCallback(null, {
                    type: "lightspeed_event",
                    topic: topic,
                    payload: jsonPayload
                });
            } catch (err) {
                console.error("Error processing Lightspeed message:", err);
            }
        });

        client.on("close", () => {
            if (!isStopped) {
                // console.log("Lightspeed connection closed, reconnecting...");
                reconnect(retryCount + 1);
            }
        });

        client.on("error", (err) => {
            // console.error("Lightspeed error:", err);
            client.end();
        });
    }

    function reconnect(retryCount) {
        const delay = Math.min(5000 * Math.pow(2, retryCount), 60000);
        setTimeout(() => startConnection(retryCount), delay);
    }

    startConnection();

    return {
        stop: () => {
            isStopped = true;
            if (client) client.end();
        }
    };
}

module.exports = function(defaultFuncs, api, ctx) {
    return function(callback) {
        const emitter = new EventEmitter();
        
        const internalCallback = (err, data) => {
            if (err) return emitter.emit("error", err);
            emitter.emit("event", data);
            if (callback) callback(null, data);
        };

        const listener = connectLightspeed(ctx, internalCallback);

        emitter.stop = listener.stop;
        return emitter;
    };
};
