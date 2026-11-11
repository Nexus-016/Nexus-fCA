/**
 * ApiFactory.js
 * 
 * Extracted API building logic from index.js
 * Responsible for creating the API object with all methods
 */

const utils = require('../../utils');
const log = require('npmlog');
const logger = require('../logger');
const { createPerformAutoLogin } = require('../../src/autoLogin');

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
        // Throw typed errors (never return undefined): loginHelper does
        // `Obj.ctx` on the result — returning undefined there crashes with a
        // generic TypeError that hides the real cause and defeats Goat-Bot's
        // ACCOUNT_LOCK guard (it pattern-matches the error text).
        if (!userCookie && !tiktikCookie) {
            throw new Error("No user cookie found (c_user/i_user missing) — cookie session expired or invalid. Export fresh cookies from a logged-in browser and replace appstate.json.");
        }
        if (html.includes("/checkpoint/block/?next") || /checkpoint\/(block|submit)/.test(html)) {
            throw new Error("Login checkpoint detected — your account is temporarily locked by Facebook. Open the account in a real browser, complete the checkpoint, then replace appstate.json with fresh cookies.");
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

        // Extract LSD + spin + jazoest (2026 merged best practice for X-Fb-Lsd headers)
        let lsdInfo = { lsd: null, spinR: null, spinB: null, spinT: null, jazoest: null, hsi: null };
        try {
            lsdInfo = this.extractLsdAndSpin(html);
        } catch (_) { }

        // Build context object
        const ctx = this.buildContext(userID, i_userID, jar, clientID, globalOptions, mqttEndpoint, region, fb_dtsg);

        // Attach LSD/spin to ctx so utils.getHeaders() can send X-Fb-Lsd + X-Fb-Spin-*
        try {
            if (lsdInfo.lsd) ctx.lsd = lsdInfo.lsd;
            if (lsdInfo.jazoest) ctx.jazoest = lsdInfo.jazoest;
            if (lsdInfo.hsi) ctx.hsi = lsdInfo.hsi;
            if (lsdInfo.spinR || lsdInfo.spinB || lsdInfo.spinT) {
                ctx.master = ctx.master || {};
                if (lsdInfo.spinR) ctx.master.__spin_r = lsdInfo.spinR;
                if (lsdInfo.spinB) ctx.master.__spin_b = lsdInfo.spinB;
                if (lsdInfo.spinT) ctx.master.__spin_t = lsdInfo.spinT;
            }
        } catch (_) { }

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
     * Extract fb_dtsg token from HTML (2026 updated patterns)
     */
    extractFbDtsg(html) {
        const dtsgRegexes = [
            /DTSGInitialData.*?token":"(.*?)"/,
            /"DTSGInitData",\[\],{"token":"(.*?)"/,
            /\["DTSGInitData",\[\],{"token":"(.*?)"/,
            /"DTSGInitialData",\[\],{"token":"(.*?)"/,
            /name="fb_dtsg" value="(.*?)"/,
            /name="dtsg_ag" value="(.*?)"/
        ];

        for (const regex of dtsgRegexes) {
            const match = html.match(regex);
            if (match && match[1]) {
                return match[1];
            }
        }

        // Fallback: JSON parsing
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
     * Extract LSD + spin + jazoest tokens (2026 merged best practice)
     * These are required for X-Fb-Lsd headers and modern FB requests.
     */
    extractLsdAndSpin(html) {
        const out = { lsd: null, spinR: null, spinB: null, spinT: null, jazoest: null, hsi: null };
        try {
            const lsdPatterns = [
                /"LSD",\[\],{"token":"(.*?)"/,
                /"LSDInitialData".*?"token":"(.*?)"/,
                /name="lsd" value="(.*?)"/,
                /\["LSD",\[\],\{"token":"(.*?)"\}/,
                /LSD.*?token["']?\s*:\s*["'](.*?)["']/
            ];
            for (const re of lsdPatterns) {
                const m = html.match(re);
                if (m && m[1]) { out.lsd = m[1]; break; }
            }
            // spin params
            let mSpin = html.match(/"__spin_r":(\d+)/) || html.match(/__spin_r["']?\s*[:=]\s*(\d+)/);
            if (mSpin) out.spinR = mSpin[1];
            let mSpinB = html.match(/"__spin_b":"(.*?)"/) || html.match(/__spin_b["']?\s*[:=]\s*["'](.*?)["']/);
            if (mSpinB) out.spinB = mSpinB[1];
            let mSpinT = html.match(/"__spin_t":(\d+)/) || html.match(/__spin_t["']?\s*[:=]\s*(\d+)/);
            if (mSpinT) out.spinT = mSpinT[1];
            const mJazo = html.match(/name="jazoest" value="(.*?)"/);
            if (mJazo) out.jazoest = mJazo[1];
            const mHsi = html.match(/"hsi":"(.*?)"/) || html.match(/name="hsi" value="(.*?)"/);
            if (mHsi) out.hsi = mHsi[1];
        } catch (_) { }
        return out;
    }

    /**
     * Build context object
     */
    buildContext(userID, i_userID, jar, clientID, globalOptions, mqttEndpoint, region, fb_dtsg) {
        const ctx = {
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
            appStatePath: globalOptions.appStatePath || null,
            pendingEdits: new Map()
        };

        // FINGERPRINT LOCK: seed the session's single User-Agent + Client Hints
        // from globalOptions.userAgent so login, HTTP requests and the MQTT
        // socket all present the SAME fingerprint. Without this, getHeaders()
        // re-rolled a random UA for HTTP while MQTT used globalOptions' UA.
        try {
            const { hintsForUA } = require('../../utils');
            if (globalOptions.userAgent && globalOptions.randomUserAgent !== true) {
                ctx._fpLocked = hintsForUA(globalOptions.userAgent);
            }
        } catch (_) { }

        // Attach performAutoLogin for session recovery
        ctx.performAutoLogin = createPerformAutoLogin(ctx, jar, globalOptions);
        
        return ctx;
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
            // MQTT typing indicator V2 (alias, real impl attached from src/)
            sendTypingIndicatorV2: function (isTyping, threadID, callback) {
                if (typeof api.sendTypingIndicator === 'function') {
                    return api.sendTypingIndicator(isTyping, threadID, callback);
                }
                if (typeof callback === 'function') callback(null, { aliased: true });
                return Promise.resolve({ aliased: true });
            },
            // re-read fca-config.json at runtime
            refreshFcaConfig: function () {
                try {
                    const fs = require("fs");
                    const path = require("path");
                    const cfgPath = path.join(process.cwd(), "fca-config.json");
                    if (fs.existsSync(cfgPath)) {
                        const fresh = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
                        Object.assign(globalOptions, fresh);
                        return fresh;
                    }
                } catch (e) {
                    log.warn("refreshFcaConfig", "Failed: " + e.message);
                }
                return null;
            },
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
                try {
                    const requiredModule = require("../../src/" + v);
                    if (typeof requiredModule === 'function') {
                        api[v.replace(".js", "")] = requiredModule(defaultFuncs, api, ctx);
                    } else {
                        log.warn("ApiFactory", `Module ${v} does not export a function. Skipping.`);
                    }
                } catch (e) {
                    log.error("ApiFactory", `Failed to load module ${v}: ${e.message}`);
                }
            });

        api.listen = api.listenMqtt;
    }

    /**
     * Initialize group message queue
     * OPTIMIZED: Added fastSend mode and parallel sending for reduced latency
     */
    initializeGroupQueue(api, ctx, globalOptions) {
        const groupQueues = new Map();
        const factory = this; // stable reference: processQueue is a plain call
        const isGroupThread = (tid) => typeof tid === 'string' && tid.length >= 15;
        const DIRECT_FN = api.sendMessage;

        api.enableGroupQueue = function (enable = true) {
            globalOptions.groupQueueEnabled = !!enable;
        };
        api.setGroupQueueCapacity = function (n) { globalOptions.groupQueueMax = n; };
        
        // NEW: Fast send mode - bypass queue for immediate response (less safe but faster)
        api.setFastSend = function (enable = false) {
            globalOptions.fastSendEnabled = !!enable;
        };
        
        // NEW: Parallel send - allow multiple concurrent sends (configurable)
        api.setParallelSend = function (maxConcurrent = 1) {
            globalOptions.parallelSendMax = Math.max(1, Math.min(maxConcurrent, 5)); // Max 5 for safety
        };
        
        // Default: Queue enabled but with faster processing
        api.enableGroupQueue(true);
        api.setGroupQueueCapacity(100);
        api.setFastSend(false);
        api.setParallelSend(3); // Allow 3 concurrent sends by default (balanced speed/safety)

        globalOptions.groupQueueIdleMs = 30 * 60 * 1000;

        api._sendMessageDirect = DIRECT_FN;
        api.sendMessage = function (message, threadID, cb, replyToMessage) {
            // Fast send mode - bypass queue completely for instant response
            if (globalOptions.fastSendEnabled) {
                return api._sendMessageDirect(message, threadID, cb, replyToMessage);
            }
            
            if (!globalOptions.groupQueueEnabled || !isGroupThread(threadID)) {
                return api._sendMessageDirect(message, threadID, cb, replyToMessage);
            }
            let entry = groupQueues.get(threadID);
            if (!entry) { 
                entry = { 
                    q: [], 
                    activeSends: 0, // Track concurrent sends instead of boolean
                    lastActive: Date.now() 
                }; 
                groupQueues.set(threadID, entry); 
            }
            entry.lastActive = Date.now();
            if (entry.q.length >= (globalOptions.groupQueueMax || 100)) {
                entry.q.shift();
                if (ctx.health) ctx.health.recordGroupQueuePrune(0, 0, 1);
            }
            entry.q.push({ message, threadID, cb, replyToMessage });
            processQueue(threadID, entry);
        };

        function processQueue(threadID, entry) {
            const maxConcurrent = globalOptions.parallelSendMax || 1;
            
            // Process multiple items concurrently up to maxConcurrent limit
            while (entry.q.length > 0 && entry.activeSends < maxConcurrent) {
                entry.activeSends++;
                const item = entry.q.shift();
                
                // NEXUS PRODUCTION FIX: one bad send must never wedge the whole
                // thread queue. A synchronous throw from _sendMessageDirect used
                // to skip the callback, leaving activeSends stuck at the limit so
                // every later message for this thread sat queued forever (bot
                // appears dead in that group). Also guard item.cb throwing.
                const settle = (err, res) => {
                    try { if (!err && factory.globalSafety) factory.globalSafety.recordEvent(); } catch (_) { }
                    try { if (typeof item.cb === 'function') item.cb(err, res); } catch (_) { }
                    entry.activeSends = Math.max(0, entry.activeSends - 1);
                    setImmediate(() => processQueue(threadID, entry));
                };
                try {
                    api._sendMessageDirect(item.message, item.threadID, settle, item.replyToMessage);
                } catch (syncErr) {
                    settle(syncErr);
                }
            }
        }

        api._flushGroupQueue = function (threadID) {
            const entry = groupQueues.get(threadID);
            if (!entry) return;
            // Flush all messages directly (parallel). Do NOT reset activeSends:
            // in-flight processQueue sends still need their decrement, and
            // flush sends bypass the counter by design.
            while (entry.q.length) {
                const item = entry.q.shift();
                try {
                    api._sendMessageDirect(item.message, item.threadID, item.cb, item.replyToMessage);
                } catch (e) {
                    try { if (typeof item.cb === 'function') item.cb(e); } catch (_) { }
                }
            }
        };

        if (!globalOptions._groupQueueSweeper) {
            globalOptions._groupQueueSweeper = setInterval(() => {
                const now = Date.now();
                let prunedThreads = 0; let expiredQueues = 0; let dropped = 0; let actions = 0;
                for (const [tid, entry] of groupQueues.entries()) {
                    if (now - entry.lastActive > (globalOptions.groupQueueIdleMs || 1800000) && entry.activeSends === 0) {
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
