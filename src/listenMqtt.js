"use strict";
const utils = require("../utils");
const log = require("npmlog");
const mqtt = require("mqtt");
const WebSocket = require("ws");
const HttpsProxyAgent = require("https-proxy-agent");
const EventEmitter = require("events");
const Duplexify = require("duplexify");
const { Transform } = require("stream");
var identity = function () { };
var form = {};
var getSeqID = function () { };
const logger = require("../lib/logger.js");
const { HealthMetrics } = require("../lib/health/HealthMetrics");

// Enhanced imports
const MqttManager = require("../lib/mqtt/MqttManager");
const { errorHandler, wrapWithErrorHandling } = require("../lib/error/ErrorHandler");
const { PerformanceOptimizer } = require("../lib/performance/PerformanceOptimizer");
const topics = [
  "/ls_req",
  "/ls_resp",
  "/legacy_web",
  "/webrtc",
  "/rtc_multi",
  "/onevc",
  "/br_sr",
  "/sr_res",
  "/t_ms",
  "/thread_typing",
  "/orca_typing_notifications",
  "/notify_disconnect",
  "/orca_presence",
  "/inbox",
  "/mercury",
  "/messaging_events",
  "/orca_message_notifications",
  "/pp",
  "/webrtc_response",
];
let WebSocket_Global;

function getRandomReconnectTime() {
  const min = 26 * 60 * 1000;
  const max = 60 * 60 * 1000;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function fetchSeqID(defaultFuncs, api, ctx, callback, retryCount = 0) {
  const maxRetries = 3;
  const baseDelay = 1000; // 1 second
  const verboseMqtt = (ctx.globalOptions && ctx.globalOptions.verboseMqtt) || process.env.NEXUS_VERBOSE_MQTT === '1';

  if (verboseMqtt) {
    log.info('fetchSeqID', `Attempting to fetch fresh SeqID (attempt ${retryCount + 1}/${maxRetries + 1})...`);
  }

  const form = {
    av: ctx.globalOptions.pageID,
    queries: JSON.stringify({
      o0: {
        doc_id: "3336396659757871",
        query_params: {
          limit: 1,
          before: null,
          tags: ["INBOX"],
          includeDeliveryReceipts: false,
          includeSeqID: true,
        },
      },
    }),
  };

  defaultFuncs
    .post("https://www.facebook.com/api/graphqlbatch/", ctx.jar, form)
    .then(utils.parseAndCheckLogin(ctx, defaultFuncs))
    .then((resData) => {
      // Validation checks
      if (utils.getType(resData) !== "Array") {
        throw { error: "Not logged in", res: resData, type: 'auth_error' };
      }

      if (resData && resData[resData.length - 1].error_results > 0) {
        throw { error: resData[0].o0.errors, type: 'graphql_error' };
      }

      if (resData[resData.length - 1].successful_results === 0) {
        throw {
          error: "getSeqId: there was no successful_results",
          res: resData,
          type: 'empty_result'
        };
      }

      // Extract SeqID
      const newSeqId = resData[0].o0.data.viewer.message_threads.sync_sequence_id;
      if (newSeqId) {
        const oldSeqId = ctx.lastSeqId;
        ctx.lastSeqId = newSeqId;

        if (verboseMqtt || oldSeqId !== newSeqId) {
          log.info('fetchSeqID', `✅ SeqID refreshed: ${oldSeqId || '(Init)'} → ${newSeqId}`);
        }

        // Also update syncToken if available
        if (resData[0].o0.data.viewer.message_threads.sync_token) {
          ctx.syncToken = resData[0].o0.data.viewer.message_threads.sync_token;
          if (verboseMqtt) {
            log.info('fetchSeqID', `✅ SyncToken also refreshed`);
          }
        }

        callback(null);
      } else {
        throw {
          error: "getSeqId: no sync_sequence_id found in response.",
          res: resData,
          type: 'missing_seqid'
        };
      }
    })
    .catch((err) => {
      const errorType = err.type || 'unknown_error';
      const isAuthError = errorType === 'auth_error' || (utils.getType(err) === "Object" && err.error === "Not logged in");

      // Auth errors are fatal, don't retry
      if (isAuthError) {
        log.error("fetchSeqID", "Authentication failed - session invalid");
        ctx.loggedIn = false;
        return callback(err);
      }

      // For other errors, retry with exponential backoff
      if (retryCount < maxRetries) {
        const delay = baseDelay * Math.pow(2, retryCount); // Exponential backoff: 1s, 2s, 4s
        log.warn("fetchSeqID", `Failed (${errorType}), retrying in ${delay}ms... (${retryCount + 1}/${maxRetries})`);

        setTimeout(() => {
          fetchSeqID(defaultFuncs, api, ctx, callback, retryCount + 1);
        }, delay);
      } else {
        // Max retries exceeded
        log.error("fetchSeqID", `Failed after ${maxRetries + 1} attempts: ${err.error || err.message || err}`);
        callback(err);
      }
    });
}

// Adaptive backoff state (per-process singleton like) - tie to ctx
function getBackoffState(ctx) {
  const envBase = parseInt(process.env.NEXUS_MQTT_BACKOFF_BASE, 10) || 1000;
  const envMax = parseInt(process.env.NEXUS_MQTT_BACKOFF_MAX, 10) || (5 * 60 * 1000);
  const envFactor = parseFloat(process.env.NEXUS_MQTT_BACKOFF_FACTOR) || 2;
  const backoffOverrides = (ctx.globalOptions && ctx.globalOptions.backoff) || {};
  const resolved = {
    base: Number.isFinite(backoffOverrides.baseMs) ? backoffOverrides.baseMs : envBase,
    max: Number.isFinite(backoffOverrides.maxMs) ? backoffOverrides.maxMs : envMax,
    factor: Number.isFinite(backoffOverrides.factor) ? backoffOverrides.factor : envFactor,
    jitter: typeof backoffOverrides.jitter === 'number' ? backoffOverrides.jitter : 0.25,
    resetAfterMs: Number.isFinite(backoffOverrides.resetAfterMs) ? backoffOverrides.resetAfterMs : (3 * 60 * 1000)
  };
  if (!ctx._adaptiveReconnect) {
    ctx._adaptiveReconnect = {
      base: resolved.base,
      max: resolved.max,
      factor: resolved.factor,
      jitter: resolved.jitter,
      resetAfterMs: resolved.resetAfterMs,
      current: 0,
      lastResetTs: 0,
      consecutiveFails: 0  // Track consecutive failures
    };
  } else {
    ctx._adaptiveReconnect.base = resolved.base;
    ctx._adaptiveReconnect.max = resolved.max;
    ctx._adaptiveReconnect.factor = resolved.factor;
    ctx._adaptiveReconnect.jitter = resolved.jitter;
    ctx._adaptiveReconnect.resetAfterMs = resolved.resetAfterMs;
  }
  return ctx._adaptiveReconnect;
}
function computeNextDelay(state) {
  if (!state.current) state.current = state.base;
  else state.current = Math.min(state.max, state.current * state.factor);
  // jitter
  const rand = (Math.random() * 2 - 1) * state.jitter; // -j..+j
  const delay = Math.max(500, Math.round(state.current * (1 + rand)));
  return delay;
}
function resetBackoff(state) {
  state.current = 0;
  state.lastResetTs = Date.now();
}
function getForegroundState(ctx) {
  if (ctx && ctx.globalOptions) {
    if (ctx.globalOptions.foreground === false) return false;
    if (ctx.globalOptions.online === false) return false;
  }
  return true;
}
function startForegroundRefresh(ctx) {
  if (ctx._foregroundRefreshInterval) {
    clearInterval(ctx._foregroundRefreshInterval);
    ctx._foregroundRefreshInterval = null;
  }
  const options = ctx.globalOptions || {};
  if (options.foregroundRefreshEnabled === false) return;
  const minutes = Number.isFinite(options.foregroundRefreshMinutes)
    ? Math.max(1, options.foregroundRefreshMinutes)
    : 15;
  ctx._foregroundRefreshInterval = setInterval(() => {
    if (!ctx.mqttClient || !ctx.mqttClient.connected) return;
    try {
      const foreground = getForegroundState(ctx);
      ctx.mqttClient.publish("/foreground_state", JSON.stringify({ foreground }), { qos: 0, retain: false });
      ctx.mqttClient.publish(
        "/set_client_settings",
        JSON.stringify({ make_user_available_when_in_foreground: true }),
        { qos: 0, retain: false }
      );
    } catch (err) {
      if (typeof log.verbose === 'function') {
        log.verbose("listenMqtt", `Foreground refresh publish failed: ${err.message || err}`);
      }
    }
  }, minutes * 60 * 1000);
}
function stopForegroundRefresh(ctx) {
  if (ctx && ctx._foregroundRefreshInterval) {
    clearInterval(ctx._foregroundRefreshInterval);
    ctx._foregroundRefreshInterval = null;
  }
}
function getStormGuard(ctx) {
  if (!ctx._mqttStorm) {
    ctx._mqttStorm = {
      events: [],
      windowMs: 60 * 60 * 1000, // Increased: 30min → 60min window for less false positives
      threshold: 20, // Increased: 12 → 20 events before triggering storm mode
      quietMs: 120 * 1000, // Increased: 90s → 120s quiet period
      extraDelayMs: 180 * 1000, // Increased: 120s → 180s extra delay
      quietUntil: 0,
      active: false,
      lastLogTs: 0
    };
  }
  return ctx._mqttStorm;
}
function noteStormEvent(ctx) {
  const guard = getStormGuard(ctx);
  const now = Date.now();
  guard.events.push(now);
  guard.events = guard.events.filter(ts => now - ts <= guard.windowMs);
  if (guard.events.length >= guard.threshold) {
    guard.active = true;
    guard.quietUntil = now + guard.quietMs;
  } else if (guard.active && now > guard.quietUntil) {
    guard.active = false;
  }
  return guard;
}
function resetStormGuard(ctx) {
  if (ctx._mqttStorm) {
    ctx._mqttStorm.events = [];
    ctx._mqttStorm.active = false;
    ctx._mqttStorm.quietUntil = 0;
    ctx._mqttStorm.lastLogTs = 0;
  }
}
function shouldLogStorm(guard) {
  if (!guard || !guard.active) return true;
  const now = Date.now();
  if (!guard.lastLogTs || now - guard.lastLogTs > guard.quietMs) {
    guard.lastLogTs = now;
    return true;
  }
  return false;
}
async function runStormRecovery(ctx, api, defaultFuncs) {
  if (ctx._stormRecoveryRunning) return;
  ctx._stormRecoveryRunning = true;
  try {
    log.warn('listenMqtt', 'Storm recovery triggered: validating session & refreshing tokens.');
    try {
      await utils.validateSession(ctx, defaultFuncs, { retries: 1, delayMs: 1000 });
    } catch (err) {
      log.warn('listenMqtt', `Storm validateSession failed: ${err.message || err}`);
    }
    if (api && typeof api.refreshFb_dtsg === 'function') {
      try {
        await api.refreshFb_dtsg();
      } catch (err) {
        log.warn('listenMqtt', `Storm fb_dtsg refresh failed: ${err.message || err}`);
      }
    }
    if (ctx.globalSafety && typeof ctx.globalSafety.refreshSafeSession === 'function') {
      try {
        await ctx.globalSafety.refreshSafeSession();
      } catch (err) {
        log.warn('listenMqtt', `Storm safe session refresh failed: ${err.message || err}`);
      }
    }
  } finally {
    ctx._stormRecoveryRunning = false;
  }
}
function scheduleStormRecovery(ctx, api, defaultFuncs, guard) {
  if (!guard || !guard.active) return;
  const now = Date.now();
  if (ctx._nextStormRecovery && now < ctx._nextStormRecovery) return;
  ctx._nextStormRecovery = now + guard.quietMs;
  runStormRecovery(ctx, api, defaultFuncs);
}
// Build lazy preflight gating
function shouldRunPreflight(ctx) {
  if (ctx.globalOptions.disablePreflight) return false;
  if (process.env.NEXUS_DISABLE_PREFLIGHT === '1' || process.env.NEXUS_DISABLE_PREFLIGHT === 'true') return false;
  // If we connected successfully within last 10 minutes, skip heavy preflight to reduce surface.
  const now = Date.now();
  const metrics = ctx.health;
  if (metrics && metrics.lastConnectTs && (now - metrics.lastConnectTs) < 10 * 60 * 1000) {
    return false;
  }
  return true;
}
function buildProxy() {
  const Proxy = new Transform({
    objectMode: false,
    transform(chunk, enc, next) {
      if (WebSocket_Global.readyState !== WebSocket.OPEN) {
        return next();
      }
      const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, "utf8");
      try {
        WebSocket_Global.send(data);
        next();
      } catch (err) {
        console.error("WebSocket send error:", err);
        next(err);
      }
    },
    flush(done) {
      if (WebSocket_Global.readyState === WebSocket.OPEN) {
        WebSocket_Global.close();
      }
      done();
    },
    writev(chunks, cb) {
      try {
        for (const { chunk } of chunks) {
          this.push(
            Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, "utf8")
          );
        }
        cb();
      } catch (err) {
        console.error("Writev error:", err);
        cb(err);
      }
    },
  });

  return Proxy;
}
function buildStream(options, WebSocket, Proxy) {
  const Stream = Duplexify(undefined, undefined, options);
  Stream.socket = WebSocket;
  let pingInterval;
  let reconnectTimeout;
  const clearTimers = () => {
    clearInterval(pingInterval);
    clearTimeout(reconnectTimeout);
  };
  WebSocket.onclose = () => {
    clearTimers();
    Stream.end();
    Stream.destroy();
  };
  WebSocket.onerror = (err) => {
    clearTimers();
    Stream.destroy(err);
  };
  WebSocket.onmessage = (event) => {
    clearTimeout(reconnectTimeout);
    const data =
      event.data instanceof ArrayBuffer
        ? Buffer.from(event.data)
        : Buffer.from(event.data, "utf8");
    Stream.push(data);
  };
  WebSocket.onopen = () => {
    Stream.setReadable(Proxy);
    Stream.setWritable(Proxy);
    Stream.emit("connect");
    // Configurable ping interval for better connection stability
    // Default 45s (within 60s keepalive window)
    const pingMs = parseInt(process.env.NEXUS_MQTT_PING_INTERVAL, 10) || 45000;
    pingInterval = setInterval(() => {
      if (WebSocket.readyState === WebSocket.OPEN) {
        try {
          WebSocket.ping();
        } catch (pingErr) {
          // Ping failed, connection likely dead
          clearTimers();
          WebSocket.close();
        }
      }
    }, pingMs);
  };
  WebSocket_Global = WebSocket;
  Proxy.on("close", () => {
    clearTimers();
    WebSocket.close();
  });
  return Stream;
}
function listenMqtt(defaultFuncs, api, ctx, globalCallback) {
  const attemptStartTs = Date.now();

  // === CONNECTION STATE MACHINE ===
  // Prevents multiple simultaneous reconnection attempts
  // States: DISCONNECTED → CONNECTING  // Connection State Machine & Guard
  if (!ctx._mqttState) {
    ctx._mqttState = {
      current: 'DISCONNECTED',
      lastTransition: 0,
      reconnectInProgress: false
    };
  }

  const now = Date.now();
  const timeSinceLast = now - ctx._mqttState.lastTransition;

  // STRICT GUARD: If we are already connecting, BLOCK EVERYTHING.
  // Unless it's been stuck for > 45 seconds, then allow force reset.
  if (ctx._mqttState.current === 'CONNECTING') {
    if (timeSinceLast < 45000) {
      // Only log if it's been a while (e.g. > 5 seconds) to avoid spamming logs every 3ms
      if (timeSinceLast > 5000) {
        log.warn('listenMqtt', `⚠️ Connection in progress... ignoring duplicate request (${timeSinceLast}ms).`);
      }
      return;
    } else {
      log.warn('listenMqtt', `⚠️ Connection STUCK in CONNECTING for ${timeSinceLast}ms. Forcing reset.`);
      try { ctx.mqttClient.end(true); } catch (_) { }
    }
  }

  // Update state immediately to block concurrent calls
  ctx._mqttState.current = 'CONNECTING';
  ctx._mqttState.lastTransition = now;
  ctx._mqttState.reconnectInProgress = true;
  const verboseMqtt = (ctx.globalOptions && ctx.globalOptions.verboseMqtt) || process.env.NEXUS_VERBOSE_MQTT === '1';
  if (verboseMqtt) {
    log.info('listenMqtt', `🔄 State transition: ${ctx._mqttState.current} (attempt start)`);
  }

  // Attach health metrics container lazily
  if (!ctx.health) ctx.health = new (require('../lib/health/HealthMetrics').HealthMetrics)();
  // Ensure tasks map exists to track ls_req -> ls_resp correlations (avoid TypeError on undefined)
  if (!ctx.tasks) ctx.tasks = new Map();
  const backoff = getBackoffState(ctx);
  if (!ctx._mqttDiag) ctx._mqttDiag = { attempts: 0, events: [] };
  ctx._mqttDiag.attempts++;
  // Suppress previously noisy test info log (visible only if verbose flag enabled or env toggled)
  if (verboseMqtt) {
    log.info('listenMqtt', `Starting Nexus MQTT bridge (attempt=${ctx._mqttDiag.attempts}, backoff=${backoff.current || 0}ms)`);
  }
  const runPreflight = shouldRunPreflight(ctx);
  if (runPreflight) {
    (async () => {
      try {
        await utils.validateSession(ctx, defaultFuncs, { retries: 1, delayMs: 1000 });
        // Session validated successfully
        if (backoff.consecutiveFails > 0) {
          log.info("listenMqtt", `Session validated OK after ${backoff.consecutiveFails} previous fails, resetting backoff.`);
          backoff.consecutiveFails = 0;
        }
      } catch (e) {
        backoff.consecutiveFails++;
        log.warn("listenMqtt", `Session validation failed (consecutive fails: ${backoff.consecutiveFails})`);

        // After many consecutive failures, try proactive cookie refresh
        if (backoff.consecutiveFails >= 10 && global.__NEXUS_COOKIE_REFRESHER__) {
          try {
            log.info("listenMqtt", "Triggering proactive cookie refresh after repeated session failures...");
            await global.__NEXUS_COOKIE_REFRESHER__.performRefresh();
          } catch (refreshErr) {
            log.warn("listenMqtt", `Cookie refresh failed: ${refreshErr.message}`);
          }
        }

        setTimeout(() => {
          utils.validateSession(ctx, defaultFuncs, { retries: 0 }).catch(err2 => {
            log.error("listenMqtt", "Session invalid after retry: Not logged in.");
            ctx.loggedIn = false;
            ctx.health.onError('session_invalid');
            globalCallback({ type: "not_logged_in", error: "Session invalid (post-retry)." });
          });
        }, 1500);
      }
    })();
  }
  const chatOn = (ctx.globalOptions && ctx.globalOptions.online === false) ? false : true;
  const foreground = getForegroundState(ctx);
  const sessionID = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER) + 1;
  const GUID = utils.getGUID();
  const username = {
    u: ctx.userID,
    s: sessionID,
    chat_on: chatOn,
    fg: foreground,
    d: GUID,
    ct: "websocket",
    aid: 219994525426954,
    aids: null,
    mqtt_sid: "",
    cp: 3,
    ecp: 10,
    st: [],
    pm: [],
    dc: "",
    no_auto_fg: true,
    gas: null,
    pack: [],
    p: null,
    php_override: ""
  };
  // jitter user agent keep consistent
  const cookies = ctx.jar.getCookies("https://www.facebook.com").join("; ");
  let host;
  if (ctx.mqttEndpoint) {
    host = `${ctx.mqttEndpoint}&sid=${sessionID}&cid=${GUID}`;
  } else if (ctx.region) {
    host = `wss://edge-chat.facebook.com/chat?region=${ctx.region.toLowerCase()}&sid=${sessionID}&cid=${GUID}`;
  } else {
    host = `wss://edge-chat.facebook.com/chat?sid=${sessionID}&cid=${GUID}`;
  }
  const options = {
    clientId: "mqttwsclient",
    protocolId: "MQIsdp",
    protocolVersion: 3,
    username: JSON.stringify(username),
    clean: true,
    wsOptions: {
      headers: {
        Cookie: cookies,
        Origin: "https://www.facebook.com",
        "User-Agent":
          ctx.globalOptions.userAgent ||
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
        Referer: "https://www.facebook.com/",
        Host: "edge-chat.facebook.com",
        Connection: "Upgrade",
        Pragma: "no-cache",
        "Cache-Control": "no-cache",
        Upgrade: "websocket",
        "Sec-WebSocket-Version": "13",
        "Accept-Encoding": "gzip, deflate, br",
        "Accept-Language": (ctx.globalOptions && ctx.globalOptions.acceptLanguage) || process.env.NEXUS_ACCEPT_LANGUAGE || "en-US,en;q=0.9",
        "Sec-WebSocket-Extensions":
          "permessage-deflate; client_max_window_bits",
      },
      origin: "https://www.facebook.com",
      protocolVersion: 13,
      binaryType: "arraybuffer",
    },
    keepalive: 60, // Increased from 30s to 60s (standard) to tolerate event loop lag
    reschedulePings: true,
    reconnectPeriod: 5000, // Increased: 1s -> 5s to prevent rapid loops
    connectTimeout: 30000, // Increased: 5s -> 30s to allow slow connections under load
    // Disable clean session to potentially recover missed messages, 
    // but typically Facebook requires clean:true for web clients. keeping true.
    clean: true,
  };
  // Proxy support via option or environment
  if (ctx.globalOptions.proxy === undefined) {
    const envProxy = process.env.NEXUS_PROXY || process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
    if (envProxy) ctx.globalOptions.proxy = envProxy;
  }
  if (ctx.globalOptions.proxy !== undefined) {
    try {
      const agent = new HttpsProxyAgent(ctx.globalOptions.proxy);
      options.wsOptions.agent = agent;
    } catch (error) {
      log.error("listenMqtt", `Failed to create proxy agent: ${error.message}`);
    }
  }
  // Create raw WebSocket first so we can attach diagnostics hooks.
  const rawWs = new WebSocket(host, options.wsOptions);
  try { require('../lib/mqtt/MqttDiagnostics')(rawWs, ctx, log); } catch (_) { }
  ctx.mqttClient = new mqtt.Client(
    () => buildStream(options, rawWs, buildProxy()),
    options
  );
  if (verboseMqtt) {
    log.info('listenMqtt', `MQTT bridge dialing ${host}`);
  }
  const mqttClient = ctx.mqttClient;
  global.mqttClient = mqttClient;
  mqttClient.on('error', function (err) {
    const errMsg = (err && (err.error || err.message || "")).toString();
    ctx.health.onError(errMsg.includes('not logged in') ? 'not_logged_in' : 'mqtt_error');
    // Increment failure counter for health tracking
    if (ctx.health && typeof ctx.health.incFailure === 'function') ctx.health.incFailure();
    if (!errMsg) {
      log.error('listenMqtt', 'Empty error message (mqtt error event). Raw err object: ' + JSON.stringify(Object.getOwnPropertyNames(err || {}).reduce((a, k) => { a[k] = err[k]; return a; }, {})));
    }
    else {
      log.error('listenMqtt', `MQTT error after ${(Date.now() - attemptStartTs)}ms: ${errMsg}`);
    }
    log.error("listenMqtt", errMsg);
    try { mqttClient.end(true); } catch (_) { }
    if (/not logged in|login_redirect|html_login_page/i.test(errMsg)) {
      ctx.loggedIn = false;
      return globalCallback({ type: "not_logged_in", error: errMsg });
    }
    if (ctx.globalOptions.autoReconnect) {
      if (ctx._mqttState) {
        ctx._mqttState.current = 'DISCONNECTED';
        ctx._mqttState.reconnectInProgress = false;
      }
      //fetch SeqID then reconnect to ensure fresh state
      fetchSeqID(defaultFuncs, api, ctx, (err) => {
        if (err) {
          log.warn("listenMqtt", "Failed to refresh SeqID on error, falling back to adaptive reconnect...");
          scheduleAdaptiveReconnect(defaultFuncs, api, ctx, globalCallback, 'seqid-refresh-failed');
        } else {
          listenMqtt(defaultFuncs, api, ctx, globalCallback);
        }
      });
    } else {
      utils.checkLiveCookie(ctx, defaultFuncs)
        .then(() => globalCallback({ type: "stop_listen", error: "Connection refused: Server unavailable" }))
        .catch(() => globalCallback({ type: "account_inactive", error: "Maybe your account is blocked by facebook, please login and check at https://facebook.com" }));
    }
  });
  // Ensure reconnection also triggers on unexpected close without prior error
  mqttClient.on('close', function () {
    ctx.health.onDisconnect();
    if (ctx.health && typeof ctx.health.incFailure === 'function') { ctx.health.incFailure(); }
    stopForegroundRefresh(ctx);

    const duration = Date.now() - attemptStartTs;
    const seconds = Math.floor(duration / 1000);

    const shortWindowMs = 5 * 60 * 1000;
    const guard = duration < shortWindowMs ? noteStormEvent(ctx) : getStormGuard(ctx);
    const allowLog = shouldLogStorm(guard);
    const stormSuffix = guard && guard.active ? ` [storm:${guard.events.length}/${Math.round(guard.windowMs / 60000)}m]` : '';
    if (guard && guard.active) {
      scheduleStormRecovery(ctx, api, defaultFuncs, guard);
    }
    // Treat long-lived connections as normal lifecycle, keep logs calm
    if (duration >= 30 * 60 * 1000) { // >= 30 minutes
      if (allowLog) log.info('listenMqtt', `MQTT connection closed after ${seconds}s (normal lifecycle). Reconnecting...${stormSuffix}`);
    } else if (duration >= 5 * 60 * 1000) { // 5-30 minutes
      if (allowLog) log.info('listenMqtt', `MQTT connection closed after ${seconds}s (remote close). Reconnecting with backoff...${stormSuffix}`);
    } else if (duration >= 60 * 1000) {
      if (allowLog) log.info('listenMqtt', `MQTT connection closed after ${seconds}s (short remote close). Reconnecting with backoff...${stormSuffix}`);
    } else {
      if (allowLog) log.warn('listenMqtt', `MQTT bridge socket closed quickly after ${duration}ms (attempt=${ctx._mqttDiag.attempts}).${stormSuffix}`);
    }

    if (!ctx.loggedIn) return; // avoid loops if logged out
    if (ctx.globalOptions.autoReconnect) {
      const backoffState = getBackoffState(ctx);
      const resetThreshold = backoffState.resetAfterMs || (3 * 60 * 1000);
      let reconnectReason = 'close';
      if (duration >= resetThreshold) {
        log.info('listenMqtt', `Resetting MQTT backoff after ${seconds}s healthy session.`);
        resetBackoff(backoffState);
        resetStormGuard(ctx);
        reconnectReason = 'close-long';
      }
      if (ctx._mqttState) {
        ctx._mqttState.current = 'DISCONNECTED';
        ctx._mqttState.reconnectInProgress = false;
      }
      scheduleAdaptiveReconnect(defaultFuncs, api, ctx, globalCallback, reconnectReason);
    }
  });

  mqttClient.on('disconnect', function () {
    ctx.health.onDisconnect();
    if (ctx.health && typeof ctx.health.incFailure === 'function') { ctx.health.incFailure(); }
    stopForegroundRefresh(ctx);

    const duration = Date.now() - attemptStartTs;
    const seconds = Math.floor(duration / 1000);

    const shortWindowMs = 5 * 60 * 1000;
    const guard = duration < shortWindowMs ? noteStormEvent(ctx) : getStormGuard(ctx);
    const allowLog = shouldLogStorm(guard);
    const stormSuffix = guard && guard.active ? ` [storm:${guard.events.length}/${Math.round(guard.windowMs / 60000)}m]` : '';
    if (guard && guard.active) {
      scheduleStormRecovery(ctx, api, defaultFuncs, guard);
    }
    if (duration >= 30 * 60 * 1000) {
      if (allowLog) log.info('listenMqtt', `MQTT disconnected after ${seconds}s (normal lifecycle). Reconnecting...${stormSuffix}`);
    } else if (duration >= 5 * 60 * 1000) {
      if (allowLog) log.info('listenMqtt', `MQTT disconnected after ${seconds}s (remote close). Reconnecting with backoff...${stormSuffix}`);
    } else if (duration >= 60 * 1000) {
      if (allowLog) log.info('listenMqtt', `MQTT disconnected after ${seconds}s (short remote close). Reconnecting with backoff...${stormSuffix}`);
    } else {
      if (allowLog) log.warn('listenMqtt', `MQTT bridge disconnect event after ${duration}ms (attempt=${ctx._mqttDiag.attempts}).${stormSuffix}`);
    }

    if (!ctx.loggedIn) return;
    if (ctx.globalOptions.autoReconnect) {
      const backoffState = getBackoffState(ctx);
      const resetThreshold = backoffState.resetAfterMs || (3 * 60 * 1000);
      let reconnectReason = 'disconnect';
      if (duration >= resetThreshold) {
        log.info('listenMqtt', `Resetting MQTT backoff after ${seconds}s healthy session.`);
        resetBackoff(backoffState);
        resetStormGuard(ctx);
        reconnectReason = 'disconnect-long';
      }
      if (ctx._mqttState) {
        ctx._mqttState.current = 'DISCONNECTED';
        ctx._mqttState.reconnectInProgress = false;
      }
      scheduleAdaptiveReconnect(defaultFuncs, api, ctx, globalCallback, reconnectReason);
    }
  });

  mqttClient.on("connect", function () {
    // Mark state as CONNECTED
    ctx._mqttState.current = 'CONNECTED';
    ctx._mqttState.reconnectInProgress = false;
    ctx._mqttState.lastTransition = Date.now();

    if (verboseMqtt) {
      log.info('listenMqtt', `✅ State transition: CONNECTED`);
    }

    resetBackoff(backoff);
    resetStormGuard(ctx);
    backoff.consecutiveFails = 0;  // Reset consecutive failures on successful connect
    // Reset or wrap MQTT attempt counter so long-lived sessions don't look scary
    ctx._mqttDiag = ctx._mqttDiag || {};
    if (typeof ctx._mqttDiag.attempts !== 'number' || ctx._mqttDiag.attempts > 100000) {
      ctx._mqttDiag.attempts = 1;
    } else {
      ctx._mqttDiag.attempts++;
    }
    ctx.health.onConnect();

    // WS3-style randomized proactive reconnect (tunable window).
    // Changed: 2-4h → 6-8h to reduce unnecessary reconnects and improve stability
    // Proactive reconnect prevents long-session forced disconnects by Facebook
    if (ctx._reconnectTimer) clearTimeout(ctx._reconnectTimer);
    let reconnectTime = null;
    const opts = ctx.globalOptions || {};
    const proactiveEnabled = opts.mqttProactiveReconnectEnabled;

    if (proactiveEnabled !== false) {
      const minM = Number.isFinite(opts.mqttProactiveReconnectMinMinutes) ? opts.mqttProactiveReconnectMinMinutes : 360; // Changed: 120min → 360min (6h)
      const maxM = Number.isFinite(opts.mqttProactiveReconnectMaxMinutes) ? opts.mqttProactiveReconnectMaxMinutes : 480; // Changed: 240min → 480min (8h)
      const min = Math.min(minM, maxM);
      const max = Math.max(minM, maxM);
      const intervalMinutes = Math.floor(Math.random() * (max - min + 1)) + min;
      reconnectTime = intervalMinutes * 60 * 1000;
    }

    if (reconnectTime) {
      if (verboseMqtt) log.info('listenMqtt', `Scheduled proactive reconnect in ${Math.floor(reconnectTime / 60000)} minutes.`);
      ctx._reconnectTimer = setTimeout(() => {
        log.info('listenMqtt', `Executing proactive lifecycle reconnect after ${Math.floor(reconnectTime / 60000)} minutes.`);
        if (ctx.mqttClient) ctx.mqttClient.end(true);
        listenMqtt(defaultFuncs, api, ctx, globalCallback);
      }, reconnectTime);
    }

    if (verboseMqtt) {
      log.info('listenMqtt', `Nexus MQTT bridge established in ${(Date.now() - attemptStartTs)}ms (attempt=${ctx._mqttDiag.attempts}).`);
    }
    if (ctx.globalSafety) { try { ctx.globalSafety.recordEvent(); } catch (_) { } }
    // Removed test-only premium features banner
    topics.forEach((topicsub) => mqttClient.subscribe(topicsub));
    var topic;
    const queue = {
      sync_api_version: 11,
      max_deltas_able_to_process: 100,
      delta_batch_size: 500,
      encoding: "JSON",
      entity_fbid: ctx.userID,
      initial_titan_sequence_id: ctx.lastSeqId,
      device_params: null,
    };
    if (ctx.syncToken) {
      topic = "/messenger_sync_get_diffs";
      queue.last_seq_id = ctx.lastSeqId;
      queue.sync_token = ctx.syncToken;
    } else {
      topic = "/messenger_sync_create_queue";
      queue.initial_titan_sequence_id = ctx.lastSeqId;
      queue.device_params = null;
    }
    mqttClient.publish(topic, JSON.stringify(queue), { qos: 1, retain: false });
    mqttClient.publish(
      "/foreground_state",
      JSON.stringify({ foreground: chatOn }),
      { qos: 1 }
    );
    mqttClient.publish(
      "/set_client_settings",
      JSON.stringify({ make_user_available_when_in_foreground: true }),
      { qos: 1 }
    );
    startForegroundRefresh(ctx);
    // Replace fixed rTimeout reconnect with health-driven logic
    const rTimeout = setTimeout(function () {
      ctx.health.onError('timeout_no_t_ms');
      mqttClient.end();
      scheduleAdaptiveReconnect(defaultFuncs, api, ctx, globalCallback, 'tms-timeout');
    }, 5000);
    ctx.tmsWait = function () {
      clearTimeout(rTimeout);
      ctx.globalOptions.emitReady
        ? globalCallback(null, {
          type: "ready",
          error: null,
          time: Date.now() // Added timestamp
        })
        : "";
      delete ctx.tmsWait;
    };
  });
  mqttClient.on("message", function (topic, message, _packet) {
    ctx.health.onMessage();
    if (ctx.globalSafety) { try { ctx.globalSafety.recordEvent(); } catch (_) { } }
    try {
      let jsonMessage = Buffer.isBuffer(message)
        ? Buffer.from(message).toString()
        : message;
      try { jsonMessage = JSON.parse(jsonMessage); } catch (e) { jsonMessage = {}; }
      // ACK tracking: detect send acknowledgements with latency hint if present
      if (jsonMessage?.message_ack) {
        const ack = jsonMessage.message_ack;
        const mid = ack.message_id || ack.mid;
        if (mid && ctx._pendingOutbound && ctx._pendingOutbound.has(mid)) {
          const started = ctx._pendingOutbound.get(mid);
          ctx._pendingOutbound.delete(mid);
          const latency = Date.now() - started;
          ctx.health.onAck(latency);
        } else {
          ctx.health.onAck();
        }
        // If this ACK corresponds to an edit, clear from pendingEdits
        if (mid && ctx.pendingEdits && ctx.pendingEdits.has(mid)) {
          ctx.pendingEdits.delete(mid);
          if (ctx.health) ctx.health.removePendingEdit(mid);
        }
      }
      if (jsonMessage?.type === 'ack') { ctx.health.onAck(); }
      // lightweight ack detection heuristic
      if (jsonMessage?.type === 'ack' || jsonMessage?.message_ack) {
        ctx.health.onAck();
      }
      if (jsonMessage.type === "jewel_requests_add") {
        globalCallback(null, {
          type: "friend_request_received",
          actorFbId: jsonMessage.from.toString(),
          timestamp: Date.now().toString(),
        });
      } else if (jsonMessage.type === "jewel_requests_remove_old") {
        globalCallback(null, {
          type: "friend_request_cancel",
          actorFbId: jsonMessage.from.toString(),
          timestamp: Date.now().toString(),
        });
      } else if (topic === "/t_ms") {
        if (ctx.tmsWait && typeof ctx.tmsWait == "function") { ctx.tmsWait(); }
        if (jsonMessage.firstDeltaSeqId && jsonMessage.syncToken) { ctx.lastSeqId = jsonMessage.firstDeltaSeqId; ctx.syncToken = jsonMessage.syncToken; }
        if (jsonMessage.lastIssuedSeqId) { ctx.lastSeqId = parseInt(jsonMessage.lastIssuedSeqId); }
        if (jsonMessage.lastIssuedSeqId) { ctx.lastSeqId = parseInt(jsonMessage.lastIssuedSeqId); }

        // High Load Optimization: Process deltas asynchronously to prevent Event Loop Starvation
        // causing MQTT heartbeats to miss their deadline and disconnect.
        if (jsonMessage.deltas) {
          jsonMessage.deltas.forEach((delta) => {
            setImmediate(() => {
              try {
                parseDelta(defaultFuncs, api, ctx, globalCallback, { delta: delta });
              } catch (e) {
                log.error("listenMqtt", `Delta processing error: ${e.message}`);
              }
            });
          });
        }
      } else if (topic === "/thread_typing" || topic === "/orca_typing_notifications") {
        const typ = { type: "typ", isTyping: !!jsonMessage.state, from: jsonMessage.sender_fbid.toString(), threadID: utils.formatID((jsonMessage.thread || jsonMessage.sender_fbid).toString()), };
        (function () { globalCallback(null, typ); })();
      } else if (topic === "/orca_presence") {
        if (!ctx.globalOptions.updatePresence) { for (const i in jsonMessage.list) { const data = jsonMessage.list[i]; const userID = data["u"]; const presence = { type: "presence", userID: userID.toString(), timestamp: data["l"] * 1000, statuses: data["p"], }; (function () { globalCallback(null, presence); })(); } }
      } else if (topic == "/ls_resp") {
        const parsedPayload = JSON.parse(jsonMessage.payload);
        const reqID = jsonMessage.request_id;
        // Guard: ctx.tasks may be empty; only proceed if it's a Map and contains the reqID
        if (ctx.tasks && typeof ctx.tasks.has === 'function' && ctx.tasks.has(reqID)) {
          const taskData = ctx["tasks"].get(reqID);
          const { type: taskType, callback: taskCallback } = taskData;
          const taskRespData = getTaskResponseData(taskType, parsedPayload);
          if (taskRespData == null) { taskCallback("error", null); } else { taskCallback(null, { type: taskType, reqID: reqID, ...taskRespData, }); }
        }
      }
    } catch (ex) {
      ctx.health.onError('message_parse');
      console.error("Message parsing error:", ex);
      if (ex.stack) console.error(ex.stack);
      return;
    }
  });
  mqttClient.on("close", function () { ctx.health.onDisconnect(); if (ctx.globalSafety) { try { ctx.globalSafety._ensureMqttAlive(); } catch (_) { } } });
  mqttClient.on("disconnect", () => { ctx.health.onDisconnect(); if (ctx.globalSafety) { try { ctx.globalSafety._ensureMqttAlive(); } catch (_) { } } });
  // Synthetic keepalive with randomized cadence (55-75s) to appear human and keep state alive
  if (!ctx._syntheticKeepAliveInterval) {
    ctx._syntheticKeepAliveInterval = setInterval(() => {
      if (!ctx.mqttClient || !ctx.mqttClient.connected) return;
      if (ctx.globalSafety) {
        const idle = Date.now() - ctx.globalSafety._lastEventTs;
        if (idle > 65 * 1000) { ctx.globalSafety.recordEvent(); ctx.health.onSynthetic(); }
      }
    }, 55000 + Math.floor(Math.random() * 20000));
  }
}
function scheduleAdaptiveReconnect(defaultFuncs, api, ctx, globalCallback, reason) {
  const state = getBackoffState(ctx);
  const guard = getStormGuard(ctx);
  let delay = computeNextDelay(state);
  if (guard && guard.active) {
    delay = Math.min(state.max, delay + guard.extraDelayMs);
  }
  ctx.health.onReconnectScheduled(delay);
  const tags = [];
  if (reason) tags.push(reason);
  if (guard && guard.active) tags.push('storm');
  const suffix = tags.length ? ` (${tags.join(', ')})` : '';
  log.warn('listenMqtt', `Reconnecting in ${delay} ms (adaptive backoff)${suffix}`);
  setTimeout(() => listenMqtt(defaultFuncs, api, ctx, globalCallback), delay);
}
function getTaskResponseData(taskType, payload) {
  try {
    switch (taskType) {
      case "send_message_mqtt": {
        return {
          type: taskType,
          threadID: payload.step[1][2][2][1][2],
          messageID: payload.step[1][2][2][1][3],
          payload: payload.step[1][2],
        };
      }
      case "set_message_reaction": {
        return {
          mid: payload.step[1][2][2][1][4],
        };
      }
      case "edit_message": {
        return {
          mid: payload.step[1][2][2][1][2],
        };
      }
    }
  } catch (error) {
    return null;
  }
}
function parseDelta(defaultFuncs, api, ctx, globalCallback, { delta }) {
  if (delta.class === "NewMessage") {
    if (ctx.globalOptions.pageID && ctx.globalOptions.pageID !== delta.queue)
      return;
    const resolveAttachmentUrl = (i) => {
      if (
        !delta.attachments ||
        i === delta.attachments.length ||
        utils.getType(delta.attachments) !== "Array"
      ) {
        let fmtMsg;
        try {
          fmtMsg = utils.formatDeltaMessage(delta);
        } catch (err) {
          return log.error("Lỗi Nhẹ", err);
        }
        if (fmtMsg) {
          if (ctx.globalOptions.autoMarkDelivery) {
            // Non-blocking mark delivered to improve performance
            setImmediate(() => markDelivery(ctx, api, fmtMsg.threadID, fmtMsg.messageID));
          }
          if (!ctx.globalOptions.selfListen && fmtMsg.senderID === ctx.userID)
            return;
          globalCallback(null, fmtMsg);
        }
      } else {
        const attachment = delta.attachments[i];
        if (attachment.mercury.attach_type === "photo") {
          api.resolvePhotoUrl(attachment.fbid, (err, url) => {
            if (!err) attachment.mercury.metadata.url = url;
            resolveAttachmentUrl(i + 1);
          });
        } else {
          resolveAttachmentUrl(i + 1);
        }
      }
    };
    resolveAttachmentUrl(0);
  } else if (delta.class === "ClientPayload") {
    const clientPayload = utils.decodeClientPayload(delta.payload);
    if (clientPayload && clientPayload.deltas) {
      for (const delta of clientPayload.deltas) {
        if (delta.deltaMessageReaction && !!ctx.globalOptions.listenEvents) {
          const messageReaction = {
            type: "message_reaction",
            threadID: (delta.deltaMessageReaction.threadKey.threadFbId
              ? delta.deltaMessageReaction.threadKey.threadFbId
              : delta.deltaMessageReaction.threadKey.otherUserFbId
            ).toString(),
            messageID: delta.deltaMessageReaction.messageId,
            reaction: delta.deltaMessageReaction.reaction,
            senderID: delta.deltaMessageReaction.senderId.toString(),
            userID: delta.deltaMessageReaction.userId.toString(),
          };
          globalCallback(null, messageReaction);
        } else if (
          delta.deltaRecallMessageData &&
          !!ctx.globalOptions.listenEvents
        ) {
          const messageUnsend = {
            type: "message_unsend",
            threadID: (delta.deltaRecallMessageData.threadKey.threadFbId
              ? delta.deltaRecallMessageData.threadKey.threadFbId
              : delta.deltaRecallMessageData.threadKey.otherUserFbId
            ).toString(),
            messageID: delta.deltaRecallMessageData.messageID,
            senderID: delta.deltaRecallMessageData.senderID.toString(),
            deletionTimestamp: delta.deltaRecallMessageData.deletionTimestamp,
            timestamp: delta.deltaRecallMessageData.timestamp,
          };
          globalCallback(null, messageUnsend);
        } else if (delta.deltaMessageReply) {
          const mdata =
            delta.deltaMessageReply.message === undefined
              ? []
              : delta.deltaMessageReply.message.data === undefined
                ? []
                : delta.deltaMessageReply.message.data.prng === undefined
                  ? []
                  : JSON.parse(delta.deltaMessageReply.message.data.prng);

          const m_id = mdata.map((u) => u.i);
          const m_offset = mdata.map((u) => u.o);
          const m_length = mdata.map((u) => u.l);
          const mentions = {};
          for (let i = 0; i < m_id.length; i++) {
            mentions[m_id[i]] = (
              delta.deltaMessageReply.message.body || ""
            ).substring(m_offset[i], m_offset[i] + m_length[i]);
          }
          const callbackToReturn = {
            type: "message_reply",
            threadID: (delta.deltaMessageReply.message.messageMetadata.threadKey
              .threadFbId
              ? delta.deltaMessageReply.message.messageMetadata.threadKey
                .threadFbId
              : delta.deltaMessageReply.message.messageMetadata.threadKey
                .otherUserFbId
            ).toString(),
            messageID:
              delta.deltaMessageReply.message.messageMetadata.messageId,
            senderID:
              delta.deltaMessageReply.message.messageMetadata.actorFbId.toString(),
            attachments: (delta.deltaMessageReply.message.attachments || [])
              .map((att) => {
                const mercury = JSON.parse(att.mercuryJSON);
                Object.assign(att, mercury);
                return att;
              })
              .map((att) => {
                let x;
                try {
                  x = utils._formatAttachment(att);
                } catch (ex) {
                  x = att;
                  x.error = ex;
                  x.type = "unknown";
                }
                return x;
              }),
            args: (delta.deltaMessageReply.message.body || "")
              .trim()
              .split(/\s+/),
            body: delta.deltaMessageReply.message.body || "",
            isGroup:
              !!delta.deltaMessageReply.message.messageMetadata.threadKey
                .threadFbId,
            mentions,
            timestamp: parseInt(
              delta.deltaMessageReply.message.messageMetadata.timestamp
            ),
            participantIDs: (
              delta.deltaMessageReply.message.participants || []
            ).map((e) => e.toString()),
          };
          if (delta.deltaMessageReply.repliedToMessage) {
            const mdata =
              delta.deltaMessageReply.repliedToMessage === undefined
                ? []
                : delta.deltaMessageReply.repliedToMessage.data === undefined
                  ? []
                  : delta.deltaMessageReply.repliedToMessage.data.prng ===
                    undefined
                    ? []
                    : JSON.parse(
                      delta.deltaMessageReply.repliedToMessage.data.prng
                    );
            const m_id = mdata.map((u) => u.i);
            const m_offset = mdata.map((u) => u.o);
            const m_length = mdata.map((u) => u.l);
            const rmentions = {};
            for (let i = 0; i < m_id.length; i++) {
              rmentions[m_id[i]] = (
                delta.deltaMessageReply.repliedToMessage.body || ""
              ).substring(m_offset[i], m_offset[i] + m_length[i]);
            }
            callbackToReturn.messageReply = {
              threadID: (delta.deltaMessageReply.repliedToMessage
                .messageMetadata.threadKey.threadFbId
                ? delta.deltaMessageReply.repliedToMessage.messageMetadata
                  .threadKey.threadFbId
                : delta.deltaMessageReply.repliedToMessage.messageMetadata
                  .threadKey.otherUserFbId
              ).toString(),
              messageID:
                delta.deltaMessageReply.repliedToMessage.messageMetadata
                  .messageId,
              senderID:
                delta.deltaMessageReply.repliedToMessage.messageMetadata.actorFbId.toString(),
              attachments: delta.deltaMessageReply.repliedToMessage.attachments
                .map((att) => {
                  let mercury;
                  try {
                    mercury = JSON.parse(att.mercuryJSON);
                    Object.assign(att, mercury);
                  } catch (ex) {
                    mercury = {};
                  }
                  return att;
                })
                .map((att) => {
                  let x;
                  try {
                    x = utils._formatAttachment(att);
                  } catch (ex) {
                    x = att;
                    x.error = ex;
                    x.type = "unknown";
                  }
                  return x;
                }),
              args: (delta.deltaMessageReply.repliedToMessage.body || "")
                .trim()
                .split(/\s+/),
              body: delta.deltaMessageReply.repliedToMessage.body || "",
              isGroup:
                !!delta.deltaMessageReply.repliedToMessage.messageMetadata
                  .threadKey.threadFbId,
              mentions: rmentions,
              timestamp: parseInt(
                delta.deltaMessageReply.repliedToMessage.messageMetadata
                  .timestamp
              ),
              participantIDs: (
                delta.deltaMessageReply.repliedToMessage.participants || []
              ).map((e) => e.toString()),
            };
          } else if (delta.deltaMessageReply.replyToMessageId) {
            return defaultFuncs
              .post("https://www.facebook.com/api/graphqlbatch/", ctx.jar, {
                av: ctx.globalOptions.pageID,
                queries: JSON.stringify({
                  o0: {
                    doc_id: "2848441488556444",
                    query_params: {
                      thread_and_message_id: {
                        thread_id: callbackToReturn.threadID,
                        message_id: delta.deltaMessageReply.replyToMessageId.id,
                      },
                    },
                  },
                }),
              })
              .then(utils.parseAndCheckLogin(ctx, defaultFuncs))
              .then((resData) => {
                if (resData[resData.length - 1].error_results > 0)
                  throw resData[0].o0.errors;
                if (resData[resData.length - 1].successful_results === 0)
                  throw {
                    error: "forcedFetch: there was no successful_results",
                    res: resData,
                  };
                const fetchData = resData[0].o0.data.message;
                const mobj = {};
                for (const n in fetchData.message.ranges) {
                  mobj[fetchData.message.ranges[n].entity.id] = (
                    fetchData.message.text || ""
                  ).substr(
                    fetchData.message.ranges[n].offset,
                    fetchData.message.ranges[n].length
                  );
                }
                callbackToReturn.messageReply = {
                  type: "Message",
                  threadID: callbackToReturn.threadID,
                  messageID: fetchData.message_id,
                  senderID: fetchData.message_sender.id.toString(),
                  attachments: fetchData.message.blob_attachment.map((att) =>
                    utils._formatAttachment({
                      blob_attachment: att,
                    })
                  ),
                  args:
                    (fetchData.message.text || "").trim().split(/\s+/) || [],
                  body: fetchData.message.text || "",
                  isGroup: callbackToReturn.isGroup,
                  mentions: mobj,
                  timestamp: parseInt(fetchData.timestamp_precise),
                };
              })
              .catch((err) => log.error("forcedFetch", err))
              .finally(() => {
                if (ctx.globalOptions.autoMarkDelivery) {
                  markDelivery(
                    ctx,
                    api,
                    callbackToReturn.threadID,
                    callbackToReturn.messageID
                  );
                }
                if (
                  !ctx.globalOptions.selfListen &&
                  callbackToReturn.senderID === ctx.userID
                )
                  return;
                globalCallback(null, callbackToReturn);
              });
          } else {
            callbackToReturn.delta = delta;
          }
          if (ctx.globalOptions.autoMarkDelivery) {
            markDelivery(
              ctx,
              api,
              callbackToReturn.threadID,
              callbackToReturn.messageID
            );
          }
          if (
            !ctx.globalOptions.selfListen &&
            callbackToReturn.senderID === ctx.userID
          )
            return;
          globalCallback(null, callbackToReturn);
        }
      }
      return;
    }
  }
  switch (delta.class) {
    case "ReadReceipt": {
      let fmtMsg;
      try {
        fmtMsg = utils.formatDeltaReadReceipt(delta);
      } catch (err) {
        return log.error("Lỗi Nhẹ", err);
      }
      globalCallback(null, fmtMsg);
      break;
    }
    case "AdminTextMessage": {
      switch (delta.type) {
        case "instant_game_dynamic_custom_update":
        case "accept_pending_thread":
        case "confirm_friend_request":
        case "shared_album_delete":
        case "shared_album_addition":
        case "pin_messages_v2":
        case "unpin_messages_v2":
        case "change_thread_theme":
        case "change_thread_nickname":
        case "change_thread_icon":
        case "change_thread_quick_reaction":
        case "change_thread_admins":
        case "group_poll":
        case "joinable_group_link_mode_change":
        case "magic_words":
        case "change_thread_approval_mode":
        case "messenger_call_log":
        case "participant_joined_group_call":
        case "rtc_call_log":
        case "update_vote": {
          let fmtMsg;
          try {
            fmtMsg = utils.formatDeltaEvent(delta);
          } catch (err) {
            console.log(delta);
            return log.error("Lỗi Nhẹ", err);
          }
          globalCallback(null, fmtMsg);
          break;
        }
      }
      break;
    }
    case "ForcedFetch": {
      if (!delta.threadKey) return;
      const mid = delta.messageId;
      const tid = delta.threadKey.threadFbId;
      if (mid && tid) {
        const form = {
          av: ctx.globalOptions.pageID,
          queries: JSON.stringify({
            o0: {
              doc_id: "2848441488556444",
              query_params: {
                thread_and_message_id: {
                  thread_id: tid.toString(),
                  message_id: mid,
                },
              },
            },
          }),
        };
        defaultFuncs
          .post("https://www.facebook.com/api/graphqlbatch/", ctx.jar, form)
          .then(utils.parseAndCheckLogin(ctx, defaultFuncs))
          .then((resData) => {
            if (resData[resData.length - 1].error_results > 0)
              throw resData[0].o0.errors;
            if (resData[resData.length - 1].successful_results === 0)
              throw {
                error: "forcedFetch: there was no successful_results",
                res: resData,
              };
            const fetchData = resData[0].o0.data.message;
            if (utils.getType(fetchData) === "Object") {
              log.info("forcedFetch", fetchData);
              switch (fetchData.__typename) {
                case "ThreadImageMessage":
                  (!ctx.globalOptions.selfListen &&
                    fetchData.message_sender.id.toString() === ctx.userID) ||
                    !ctx.loggedIn
                    ? undefined
                    : (function () {
                      globalCallback(null, {
                        type: "event",
                        threadID: utils.formatID(tid.toString()),
                        logMessageType: "log:thread-image",
                        logMessageData: {
                          image: {
                            attachmentID:
                              fetchData.image_with_metadata &&
                              fetchData.image_with_metadata
                                .legacy_attachment_id,
                            width:
                              fetchData.image_with_metadata &&
                              fetchData.image_with_metadata
                                .original_dimensions.x,
                            height:
                              fetchData.image_with_metadata &&
                              fetchData.image_with_metadata
                                .original_dimensions.y,
                            url:
                              fetchData.image_with_metadata &&
                              fetchData.image_with_metadata.preview.uri,
                          },
                        },
                        logMessageBody: fetchData.snippet,
                        timestamp: fetchData.timestamp_precise,
                        author: fetchData.message_sender.id,
                      });
                    })();
                  break;
                case "UserMessage": {
                  const event = {
                    type: "message",
                    senderID: utils.formatID(fetchData.message_sender.id),
                    body: fetchData.message.text || "",
                    threadID: utils.formatID(tid.toString()),
                    messageID: fetchData.message_id,
                    attachments: [
                      {
                        type: "share",
                        ID: fetchData.extensible_attachment
                          .legacy_attachment_id,
                        url: fetchData.extensible_attachment.story_attachment
                          .url,
                        title:
                          fetchData.extensible_attachment.story_attachment
                            .title_with_entities.text,
                        description:
                          fetchData.extensible_attachment.story_attachment
                            .description.text,
                        source:
                          fetchData.extensible_attachment.story_attachment
                            .source,
                        image: (
                          (
                            fetchData.extensible_attachment.story_attachment
                              .media || {}
                          ).image || {}
                        ).uri,
                        width: (
                          (
                            fetchData.extensible_attachment.story_attachment
                              .media || {}
                          ).image || {}
                        ).width,
                        height: (
                          (
                            fetchData.extensible_attachment.story_attachment
                              .media || {}
                          ).image || {}
                        ).height,
                        playable:
                          (
                            fetchData.extensible_attachment.story_attachment
                              .media || {}
                          ).is_playable || false,
                        duration:
                          (
                            fetchData.extensible_attachment.story_attachment
                              .media || {}
                          ).playable_duration_in_ms || 0,
                        subattachments:
                          fetchData.extensible_attachment.subattachments,
                        properties:
                          fetchData.extensible_attachment.story_attachment
                            .properties,
                      },
                    ],
                    mentions: {},
                    timestamp: parseInt(fetchData.timestamp_precise),
                    isGroup: fetchData.message_sender.id !== tid.toString(),
                  };
                  log.info("ff-Return", event);
                  globalCallback(null, event);
                  break;
                }
                default:
                  log.error("forcedFetch", fetchData);
              }
            } else {
              log.error("forcedFetch", fetchData);
            }
          })
          .catch((err) => log.error("forcedFetch", err));
      }
      break;
    }
    case "ThreadName":
    case "ParticipantsAddedToGroupThread":
    case "ParticipantLeftGroupThread": {
      let formattedEvent;
      try {
        formattedEvent = utils.formatDeltaEvent(delta);
      } catch (err) {
        console.log(err);
        return log.error("Lỗi Nhẹ", err);
      }
      if (
        !ctx.globalOptions.selfListen &&
        formattedEvent.author.toString() === ctx.userID
      )
        return;
      if (!ctx.loggedIn) return;
      globalCallback(null, formattedEvent);
      break;
    }
    case "NewMessage": {
      const hasLiveLocation = (delta) => {
        const attachment =
          delta.attachments?.[0]?.mercury?.extensible_attachment;
        const storyAttachment = attachment?.story_attachment;
        return storyAttachment?.style_list?.includes("message_live_location");
      };
      if (delta.attachments?.length === 1 && hasLiveLocation(delta)) {
        delta.class = "UserLocation";
        try {
          const fmtMsg = utils.formatDeltaEvent(delta);
          globalCallback(null, fmtMsg);
        } catch (err) {
          console.log(delta);
          log.error("Lỗi Nhẹ", err);
        }
      }
      break;
    }
  }
}
function markDelivery(ctx, api, threadID, messageID) {
  if (threadID && messageID) {
    api.markAsDelivered(threadID, messageID, (err) => {
      if (err) log.error("markAsDelivered", err);
      else {
        if (ctx.globalOptions.autoMarkRead) {
          api.markAsRead(threadID, (err) => {
            if (err) log.error("markAsDelivered", err);
          });
        }
      }
    });
  }
}
module.exports = function (defaultFuncs, api, ctx) {
  let globalCallback = identity;
  getSeqID = function getSeqID() {
    ctx.t_mqttCalled = false;
    fetchSeqID(defaultFuncs, api, ctx, (err) => {
      if (err) return globalCallback(err);
      listenMqtt(defaultFuncs, api, ctx, globalCallback);
    });
  };
  return function (callback) {
    class MessageEmitter extends EventEmitter {
      stopListening(callback) {
        callback = callback || (() => { });
        globalCallback = identity;
        if (ctx._reconnectTimer) clearTimeout(ctx._reconnectTimer);
        if (ctx.mqttClient) {
          ctx.mqttClient.unsubscribe("/webrtc");
          ctx.mqttClient.unsubscribe("/rtc_multi");
          ctx.mqttClient.unsubscribe("/onevc");
          ctx.mqttClient.publish("/browser_close", "{}");
          ctx.mqttClient.end(false, function (...data) {
            callback(data);
            ctx.mqttClient = undefined;
          });
        }
      }
      async stopListeningAsync() {
        return new Promise((resolve) => {
          this.stopListening(resolve);
        });
      }
    }
    const msgEmitter = new MessageEmitter();
    globalCallback =
      callback ||
      function (error, message) {
        if (error) {
          return msgEmitter.emit("error", error);
        }
        msgEmitter.emit("message", message);
      };
    if (!ctx.firstListen) ctx.lastSeqId = null;
    ctx.syncToken = undefined;
    ctx.t_mqttCalled = false;
    form = {
      av: ctx.globalOptions.pageID,
      queries: JSON.stringify({
        o0: {
          doc_id: "3336396659757871",
          query_params: {
            limit: 1,
            before: null,
            tags: ["INBOX"],
            includeDeliveryReceipts: false,
            includeSeqID: true,
          },
        },
      }),
    };
    if (!ctx.firstListen || !ctx.lastSeqId) {
      getSeqID(defaultFuncs, api, ctx, globalCallback);
    } else {
      listenMqtt(defaultFuncs, api, ctx, globalCallback);
    }
    api.stopListening = msgEmitter.stopListening;
    api.stopListeningAsync = msgEmitter.stopListeningAsync;
    return msgEmitter;
  };
};