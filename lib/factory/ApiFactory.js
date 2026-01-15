/**
 * ApiFactory.js
 * 
 * Extracted API building logic from index.js
 * Responsible for creating the API object with all methods
 */

const utils = require('../../utils');
const log = require('npmlog');
const logger = require('../logger');

class ApiFactory {
    constructor(globalSafety) {
        this.globalSafety = globalSafety;
    }

    /**
     * Build the complete API object from HTML response
     */
    buildAPI(globalOptions, html, jar) {
        const cookies = jar.getCookies("https://www.facebook.com");
        const userCookie = cookies.find(c => c.cookieString().startsWith("c_user="));
        const tiktikCookie = cookies.find(c => c.cookieString().startsWith("i_user="));

        // Validate cookies
        // Validate cookies
        if (!userCookie && !tiktikCookie) {
            return log.error('login', "No user cookie found. Please check your credentials or appstate.json validity.");
        } else if (html.includes("/checkpoint/block/?next")) {
            return log.error('login', "Checkpoint detected! Your account might be temporarily locked. Please login via browser to verify.", 'error');
        }

        const userID = (tiktikCookie || userCookie).cookieString().split("=")[1];
        const i_userID = tiktikCookie ? tiktikCookie.cookieString().split("=")[1] : null;
        logger(`👤 Active Session: ${userID}`, 'info');

        const clientID = ((Math.random() * 2147483648) | 0).toString(16);
        let mqttEndpoint, region, fb_dtsg, irisSeqID;

        // Extract MQTT endpoint and region
        try {
            const endpointMatch = html.match(/"endpoint":"([^"]+)"/);
            if (endpointMatch) {
                mqttEndpoint = endpointMatch[1].replace(/\\\//g, "/");
                const url = new URL(mqttEndpoint);
                region = url.searchParams.get("region")?.toUpperCase() || "PRN";
            }
        } catch (e) {
            log.warning("login", "Not MQTT endpoint");
        }

        // Allow environment override for region
        if (process.env.NEXUS_REGION) {
            try { region = process.env.NEXUS_REGION.toUpperCase(); } catch (_) { }
        }

        // Extract fb_dtsg
        fb_dtsg = this.extractFbDtsg(html);

        // Build context object
        const ctx = this.buildContext(userID, i_userID, jar, clientID, globalOptions, mqttEndpoint, region, fb_dtsg);

        // Build API object
        const api = this.buildApiMethods(ctx, globalOptions);

        // Build defaultFuncs
        const defaultFuncs = utils.makeDefaults(html, i_userID || userID, ctx);

        // Wrap with safety
        this.wrapWithSafety(api, defaultFuncs, globalOptions);

        // Attach all API methods from src/
        this.attachSrcMethods(api, defaultFuncs, ctx);

        // Initialize group queue
        this.initializeGroupQueue(api, ctx, globalOptions);

        return { ctx, defaultFuncs, api };
    }

    /**
     * Extract fb_dtsg token from HTML
     */
    extractFbDtsg(html) {
        const dtsgRegexes = [
            /DTSGInitialData.*?token":"(.*?)"/,
            /"DTSGInitData",\[\],{"token":"(.*?)"/,
            /\["DTSGInitData",\[\],{"token":"(.*?)"/,
            /name="fb_dtsg" value="(.*?)"/,
            /name="dtsg_ag" value="(.*?)"/
        ];

        for (const regex of dtsgRegexes) {
            const match = html.match(regex);
            if (match && match[1]) {
                return match[1];
            }
        }

        // Fallback: JSON parsing (inspired by ws3-fca)
        try {
            const extractNetData = (html) => {
                const allScriptsData = [];
                const scriptRegex = /<script type="application\/json"[^>]*>(.*?)<\/script>/g;
                let match;
                while ((match = scriptRegex.exec(html)) !== null) {
                    try {
                        allScriptsData.push(JSON.parse(match[1]));
                    } catch (e) { }
                }
                return allScriptsData;
            };

            const netData = extractNetData(html);

            const findConfig = (key) => {
                for (const scriptData of netData) {
                    if (scriptData.require) {
                        for (const req of scriptData.require) {
                            if (Array.isArray(req) && req[0] === key && req[2]) {
                                return req[2];
                            }
                            if (Array.isArray(req) && req[3] && req[3][0] && req[3][0].__bbox && req[3][0].__bbox.define) {
                                for (const def of req[3][0].__bbox.define) {
                                    if (Array.isArray(def) && def[0].endsWith(key) && def[2]) {
                                        return def[2];
                                    }
                                }
                            }
                        }
                    }
                }
                return null;
            };

            const dtsgData = findConfig("DTSGInitialData");
            if (dtsgData && dtsgData.token) {
                log.verbose("login", "Found fb_dtsg via JSON parsing");
                return dtsgData.token;
            }
        } catch (e) {
            log.verbose("login", "JSON parsing for fb_dtsg failed: " + e.message);
        }

        // Return null if not found (will be handled by fallback logic in index.js)
        return null;
    }

    /**
     * Build context object
     */
    buildContext(userID, i_userID, jar, clientID, globalOptions, mqttEndpoint, region, fb_dtsg) {
        return {
            userID: userID,
            i_userID: i_userID,
            jar: jar,
            clientID: clientID,
            globalOptions: globalOptions,
            loggedIn: true,
            access_token: "NONE",
            clientMutationId: 0,
            mqttClient: undefined,
            lastSeqId: undefined,
            syncToken: undefined,
            mqttEndpoint,
            region,
            firstListen: true,
            fb_dtsg,
            wsReqNumber: 0,
            wsTaskNumber: 0,
            globalSafety: this.globalSafety,
            pendingEdits: new Map()
        };
    }

    /**
     * Build base API methods
     */
    buildApiMethods(ctx, globalOptions) {
        const api = {
            setOptions: (options) => {
                Object.keys(options).forEach(key => {
                    globalOptions[key] = options[key];
                });
            },
            autoTyping: (enable = true) => {
                globalOptions.autoTyping = !!enable;
            },
            getAppState: function () {
                const appState = utils.getAppState(ctx.jar);
                return appState.filter((item, index, self) =>
                    self.findIndex((t) => t.key === item.key) === index
                );
            },
            healthCheck: function (callback) {
                callback(null, {
                    status: 'ok',
                    time: new Date().toISOString(),
                    userID: ctx.userID || null,
                    metrics: ctx.health ? ctx.health.snapshot() : null
                });
            },
            getHealthMetrics: function () { return ctx.health ? ctx.health.snapshot() : null; },
            getMqttDiagnostics: function () { return ctx.getMqttDiagnostics ? ctx.getMqttDiagnostics() : (ctx._mqttDiag || null); },
            enableLazyPreflight(enable = true) { ctx.globalOptions.disablePreflight = !enable; },
            setBackoffOptions(opts = {}) { ctx.globalOptions.backoff = Object.assign(ctx.globalOptions.backoff || {}, opts); },
            setEditOptions(opts = {}) { Object.assign(ctx.globalOptions.editSettings, opts); },
            getMemoryMetrics() {
                if (!ctx.health) return null;
                const snap = ctx.health.snapshot();
                return {
                    pendingEdits: snap.pendingEdits,
                    pendingEditsDropped: snap.pendingEditsDropped,
                    pendingEditsExpired: snap.pendingEditsExpired,
                    outboundQueueDepth: snap.outboundQueueDepth,
                    groupQueueDroppedMessages: snap.groupQueueDroppedMessages,
                    memoryGuardRuns: snap.memoryGuardRuns,
                    memoryGuardActions: snap.memoryGuardActions
                };
            }
        };

        // Default options
        if (typeof globalOptions.autoTyping === 'undefined') {
            globalOptions.autoTyping = true; // Enabled by default for safety
        }

        // Default edit settings
        if (!globalOptions.editSettings) {
            globalOptions.editSettings = {
                maxPendingEdits: 200,
                editTTLms: 5 * 60 * 1000,
                ackTimeoutMs: 12000,
                maxResendAttempts: 2
            };
        }

        return api;
    }

    /**
     * Wrap API methods with safety throttling
     */
    wrapWithSafety(api, defaultFuncs, globalOptions) {
        // Wrap defaultFuncs methods
        const originalPost = defaultFuncs.post;
        const originalPostFormData = defaultFuncs.postFormData;
        const originalGet = defaultFuncs.get;

        defaultFuncs.post = async function (...args) {
            if (this.globalSafety && typeof this.globalSafety.applyAdaptiveSendDelay === 'function') {
                await this.globalSafety.applyAdaptiveSendDelay();
            }
            return originalPost.apply(this, args);
        }.bind(this);

        defaultFuncs.postFormData = async function (...args) {
            if (this.globalSafety && typeof this.globalSafety.applyAdaptiveSendDelay === 'function') {
                await this.globalSafety.applyAdaptiveSendDelay();
            }
            return originalPostFormData.apply(this, args);
        }.bind(this);

        defaultFuncs.get = async function (...args) {
            if (this.globalSafety && typeof this.globalSafety.applyAdaptiveSendDelay === 'function') {
                await this.globalSafety.applyAdaptiveSendDelay();
            }
            return originalGet.apply(this, args);
        }.bind(this);
    }

    /**
     * Attach all methods from src/ directory
     */
    attachSrcMethods(api, defaultFuncs, ctx) {
        require("fs")
            .readdirSync(__dirname + "/../../src/")
            .filter((v) => v.endsWith(".js"))
            .map(function (v) {
                api[v.replace(".js", "")] = require("../../src/" + v)(defaultFuncs, api, ctx);
            });

        api.listen = api.listenMqtt;
    }

    /**
     * Initialize group message queue
     */
    initializeGroupQueue(api, ctx, globalOptions) {
        const groupQueues = new Map();
        const isGroupThread = (tid) => typeof tid === 'string' && tid.length >= 15;
        const DIRECT_FN = api.sendMessage;

        api.enableGroupQueue = function (enable = true) {
            globalOptions.groupQueueEnabled = !!enable;
        };
        api.setGroupQueueCapacity = function (n) { globalOptions.groupQueueMax = n; };
        api.enableGroupQueue(true);
        api.setGroupQueueCapacity(100);

        globalOptions.groupQueueIdleMs = 30 * 60 * 1000;

        api._sendMessageDirect = DIRECT_FN;
        api.sendMessage = function (message, threadID, cb, replyToMessage) {
            // New: Auto-Typing support for improved human-like behavior
            if (globalOptions.autoTyping) {
                try {
                    api.sendTypingIndicator(threadID, (err) => {
                        // Ignore typing errors to avoid blocking the message
                    });
                } catch (_) { /* ignore */ }
            }

            if (!globalOptions.groupQueueEnabled || !isGroupThread(threadID)) {
                return api._sendMessageDirect(message, threadID, cb, replyToMessage);
            }
            let entry = groupQueues.get(threadID);
            if (!entry) { entry = { q: [], sending: false, lastActive: Date.now() }; groupQueues.set(threadID, entry); }
            entry.lastActive = Date.now();
            if (entry.q.length >= (globalOptions.groupQueueMax || 100)) {
                entry.q.shift();
                if (ctx.health) ctx.health.recordGroupQueuePrune(0, 0, 1);
            }
            entry.q.push({ message, threadID, cb, replyToMessage });
            processQueue(threadID, entry);
        };

        function processQueue(threadID, entry) {
            if (entry.sending) return;
            if (!entry.q.length) return;
            entry.sending = true;
            const item = entry.q.shift();
            api._sendMessageDirect(item.message, item.threadID, function (err, res) {
                try { if (!err && this.globalSafety) this.globalSafety.recordEvent(); } catch (_) { }
                if (typeof item.cb === 'function') item.cb(err, res);
                entry.sending = false;
                setImmediate(() => processQueue(threadID, entry));
            }.bind(this), item.replyToMessage);
        }

        api._flushGroupQueue = function (threadID) {
            const entry = groupQueues.get(threadID);
            if (!entry) return;
            while (entry.q.length) {
                const item = entry.q.shift();
                api._sendMessageDirect(item.message, item.threadID, item.cb);
            }
            entry.sending = false;
        };

        if (!globalOptions._groupQueueSweeper) {
            globalOptions._groupQueueSweeper = setInterval(() => {
                const now = Date.now();
                let prunedThreads = 0; let expiredQueues = 0; let dropped = 0; let actions = 0;
                for (const [tid, entry] of groupQueues.entries()) {
                    if (now - entry.lastActive > (globalOptions.groupQueueIdleMs || 1800000) && !entry.sending) {
                        if (entry.q.length) { dropped += entry.q.length; }
                        groupQueues.delete(tid); expiredQueues++; actions++;
                        continue;
                    }
                    const cap = globalOptions.groupQueueMax || 100;
                    if (entry.q.length > cap) {
                        const overflow = entry.q.length - cap;
                        entry.q.splice(0, overflow);
                        dropped += overflow; actions++;
                    }
                }
                if ((prunedThreads || expiredQueues || dropped) && ctx.health) {
                    ctx.health.recordGroupQueuePrune(prunedThreads, expiredQueues, dropped);
                    ctx.health.recordMemoryGuardRun(actions);
                }
            }, 5 * 60 * 1000);
        }
    }
}

module.exports = ApiFactory;
