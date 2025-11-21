"use strict";
// Nexus-FCA: Advanced and Safe Facebook Chat API (Enhanced Version)
const utils = require("./utils");
const log = require("npmlog");
const { execSync } = require('child_process');
const { promises: fsPromises, readFileSync } = require('fs');
const fs = require('fs');
const axios = require('axios');
const path = require('path');
const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");
const models = require("./lib/database/models");
const logger = require("./lib/logger");
const { safeMode, ultraSafeMode, smartSafetyLimiter, isUserAllowed } = require('./utils'); // Enhanced safety system
// Minimal aesthetic banner system
let _fancyBannerPrinted = false;
const gradient = (() => { try { return require('gradient-string'); } catch(_) { return null; } })();
const pkgMeta = (() => { try { return require('./package.json'); } catch(_) { return { version: 'dev' }; } })();
function printFancyStartupBanner() {
  if (_fancyBannerPrinted) return; _fancyBannerPrinted = true;
  const lines = [
    '╔══════════════════════════════════════════════════════╗',
    '║ Nexus-FCA Secure Login                               ║',
    '║ Advanced Stable Messenger Automation API             ║',
    '╚══════════════════════════════════════════════════════╝'
  ];
  if (gradient) console.log(gradient.cristal.multiline(lines.join('\n'))); else console.log(lines.join('\n'));
}
function printIdentityBanner(uid, name) {
  const cleanName = name || 'Unknown';
  const pad = (txt, len) => (txt.length < len ? txt + ' '.repeat(len - txt.length) : txt.substring(0, len));
  const bodyLen = 54;
  const line = (content) => `║ ${pad(content, bodyLen)} ║`;
  const box = [
    '╔════════════════ LOGGED IN IDENTITY ════════════════╗',
    line(`UID : ${uid}`),
    line(`Name: ${cleanName}`),
    '╚════════════════════════════════════════════════════╝'
  ];
  if (gradient) console.log(gradient.atlas.multiline(box.join('\n'))); else console.log(box.join('\n'));
}

// Enhanced imports - All new modules
const { NexusClient } = require('./lib/compatibility/NexusClient');
const { CompatibilityLayer } = require('./lib/compatibility/CompatibilityLayer');
const { performanceManager, PerformanceManager } = require('./lib/performance/PerformanceManager');
const { errorHandler, ErrorHandler } = require('./lib/error/ErrorHandler');
const { AdvancedMqttManager } = require('./lib/mqtt/AdvancedMqttManager');
const { EnhancedDatabase } = require('./lib/database/EnhancedDatabase');
const { Message } = require('./lib/message/Message');
const { Thread } = require('./lib/message/Thread');
const { User } = require('./lib/message/User');

// Advanced Safety Module - Minimizes ban/lock/checkpoint rates
const FacebookSafety = require('./lib/safety/FacebookSafety');
const { SingleSessionGuard } = require('./lib/safety/SingleSessionGuard');
const { CookieRefresher } = require('./lib/safety/CookieRefresher');
const { CookieManager } = require('./lib/safety/CookieManager');

// NEW: Advanced Network & Authentication Modules
const EmailPasswordLogin = require('./lib/auth/EmailPasswordLogin');
const ProxyManager = require('./lib/network/ProxyManager');
const UserAgentManager = require('./lib/network/UserAgentManager');

// Core compatibility imports
const MqttManager = require('./lib/mqtt/MqttManager');
const { DatabaseManager, getInstance } = require('./lib/database/DatabaseManager');
const { PerformanceOptimizer, getInstance: getPerformanceOptimizerInstance } = require('./lib/performance/PerformanceOptimizer');

// Initialize global safety manager with ultra-low ban rate protection
const globalSafety = new FacebookSafety({
  enableSafeHeaders: true,
  enableHumanBehavior: true,
  enableAntiDetection: true,
  enableAutoRefresh: true,
  enableLoginValidation: true,
  enableSafeDelays: true, // Human-like delays to reduce detection
  bypassRegionLock: true,
  ultraLowBanMode: ultraSafeMode // Ultra-low ban rate mode
});

let checkVerified = null;
const defaultLogRecordSize = 100;
log.maxRecordSize = defaultLogRecordSize;
const defaultConfig = {
  autoUpdate: true,
  mqtt: {
    enabled: true,
    reconnectInterval: 3600,
  }
};
const configPath = path.join(process.cwd(), "fca-config.json");
let config;
if (!fs.existsSync(configPath)) {
  fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
  config = defaultConfig;
} else {
  try {
    const fileContent = fs.readFileSync(configPath, 'utf8');
    config = JSON.parse(fileContent);
    config = { ...defaultConfig, ...config };
  } catch (err) {
    logger("Error reading config file, using defaults", "error");
    config = defaultConfig;
  }
}
global.fca = {
  config: config
};
const Boolean_Option = [
  "online",
  "selfListen",
  "listenEvents",
  "updatePresence",
  "forceLogin",
  "autoMarkDelivery",
  "autoMarkRead",
  "listenTyping",
  "autoReconnect",
  "emitReady",
];
function setOptions(globalOptions, options) {
  Object.keys(options).map(function (key) {
    switch (Boolean_Option.includes(key)) {
      case true: {
        globalOptions[key] = Boolean(options[key]);
        break;
      }
      case false: {
        switch (key) {
          case "pauseLog": {
            if (options.pauseLog) log.pause();
            else log.resume();
            break;
          }
          case "logLevel": {
            log.level = options.logLevel;
            globalOptions.logLevel = options.logLevel;
            break;
          }
          case "logRecordSize": {
            log.maxRecordSize = options.logRecordSize;
            globalOptions.logRecordSize = options.logRecordSize;
            break;
          }
          case "pageID": {
            globalOptions.pageID = options.pageID.toString();
            break;
          }
          case "userAgent": {
            globalOptions.userAgent =
              options.userAgent ||
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
            break;
          }
          case "proxy": {
            if (typeof options.proxy != "string") {
              delete globalOptions.proxy;
              utils.setProxy();
            } else {
              globalOptions.proxy = options.proxy;
              utils.setProxy(globalOptions.proxy);
            }
            break;
          }
          default: {
            log.warn(
              "setOptions",
              "Unrecognized option given to setOptions: " + key
            );
            break;
          }
        }
        break;
      }
    }
  });
}
function buildAPI(globalOptions, html, jar) {
  const cookies = jar.getCookies("https://www.facebook.com");
  const userCookie = cookies.find(c => c.cookieString().startsWith("c_user="));
  const tiktikCookie = cookies.find(c => c.cookieString().startsWith("i_user="));
  if (userCookie.length === 0 && tiktikCookie.length === 0) {
    return log.error('login', "Không tìm thấy cookie cho người dùng, vui lòng kiểm tra lại thông tin đăng nhập")
  } else if (!userCookie && !tiktikCookie) {
    return log.error('login', "Không tìm thấy cookie cho người dùng, vui lòng kiểm tra lại thông tin đăng nhập")
  } else if (html.includes("/checkpoint/block/?next")) {
    return log.error('login', "Appstate die, vui lòng thay cái mới!", 'error');
  }
  const userID = (tiktikCookie || userCookie).cookieString().split("=")[1];
  const i_userID = tiktikCookie ? tiktikCookie.cookieString().split("=")[1] : null;
  logger(`Logged in as ${userID}`, 'info');
  try {
    clearInterval(checkVerified);
  } catch (_) { }
  const clientID = ((Math.random() * 2147483648) | 0).toString(16);
  let mqttEndpoint, region, fb_dtsg, irisSeqID;
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
  // Allow environment override for region (useful on PaaS where HTML may omit region or mismatch)
  if (process.env.NEXUS_REGION) {
    try { region = process.env.NEXUS_REGION.toUpperCase(); } catch(_) {}
  }
  const tokenMatch = html.match(/DTSGInitialData.*?token":"(.*?)"/);
  if (tokenMatch) {
    fb_dtsg = tokenMatch[1];
  }


  // Initialize enhanced systems
  const dbManager = getInstance();
  const performanceOptimizer = getPerformanceOptimizerInstance();
  (async () => {
    try {
      await models.sequelize.authenticate();
      await models.syncAll();
    } catch (error) {
      console.error(error);
      console.error('Database connection failed:', error.message);
    }
  })();
  // Professional gradient banner for Nexus-FCA
  logger('═══════════════════════════════════════════════════════════════════════════════', 'info');
  logger('             Nexus-FCA - Advanced & Safe Facebook Chat API', 'info');
  logger('═══════════════════════════════════════════════════════════════════════════════', 'info');
  logger(`Nexus-FCA`, 'info');
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
    lastSeqId: irisSeqID,
    syncToken: undefined,
    mqttEndpoint,
    region,
    firstListen: true,
    fb_dtsg,
    wsReqNumber: 0,
    wsTaskNumber: 0,
    // Provide safety module reference to lower layers (listenMqtt)
    globalSafety,
    // Pending edit tracking (Stage 2)
    pendingEdits: new Map()
  };
  // Default edit / resend safety settings
  if(!globalOptions.editSettings){
    globalOptions.editSettings = {
      maxPendingEdits: 200,
      editTTLms: 5*60*1000,
      ackTimeoutMs: 12000,
      maxResendAttempts: 2
    };
  }
  const api = {
    setOptions: setOptions.bind(null, globalOptions),
    getAppState: function getAppState() {
      const appState = utils.getAppState(jar);
      return appState.filter(
        (item, index, self) =>
          self.findIndex((t) => {
            return t.key === item.key;
          }) === index
      );
    },
    healthCheck: function(callback) {
      callback(null, {
        status: 'ok',
        safeMode,
        time: new Date().toISOString(),
        userID: ctx.userID || null,
        metrics: ctx.health ? ctx.health.snapshot() : null
      });
    },
    getHealthMetrics: function(){ return ctx.health ? ctx.health.snapshot() : null; },
  getMqttDiagnostics: function(){ return ctx.getMqttDiagnostics ? ctx.getMqttDiagnostics() : (ctx._mqttDiag || null); },
    enableLazyPreflight(enable=true){ ctx.globalOptions.disablePreflight = !enable; },
    setBackoffOptions(opts={}){ ctx.globalOptions.backoff = Object.assign(ctx.globalOptions.backoff||{}, opts); },
    setEditOptions(opts={}){ Object.assign(ctx.globalOptions.editSettings, opts); },
    getMemoryMetrics(){
      if(!ctx.health) return null;
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
  const defaultFuncs = utils.makeDefaults(html, i_userID || userID, ctx);
  require("fs")
    .readdirSync(__dirname + "/src/")
    .filter((v) => v.endsWith(".js"))
    .map(function (v) {
      api[v.replace(".js", "")] = require("./src/" + v)(defaultFuncs, api, ctx);
    });
  api.listen = api.listenMqtt;
  // Adaptive outbound pacing wrapper (dynamic risk + post-maintenance window)
  if (!api._adaptivePacingWrapped && typeof api.sendMessage === 'function') {
    const _origSend = api.sendMessage;
    api.sendMessage = async function(message, threadID, callback){
      try { if (globalSafety && typeof globalSafety.applyAdaptiveSendDelay === 'function') await globalSafety.applyAdaptiveSendDelay(); } catch(_) {}
      return _origSend(message, threadID, callback);
    };
    api._adaptivePacingWrapped = true;
  }
  // Safety wrapper: ensure every inbound MQTT event updates safety lastEvent timestamp
  if (!api._safetyWrappedListen) {
    const _origListen = api.listenMqtt;
    api.listenMqtt = function(callback) {
      const wrapped = (err, evt) => {
        if (!err && evt) {
          try { globalSafety.recordEvent(); } catch(_) {}
        }
        if (typeof callback === 'function') callback(err, evt);
      };
      const emitter = _origListen(wrapped);
      // Redundant defensive hooks
      try {
        emitter.on('message', () => globalSafety.recordEvent());
        emitter.on('error', () => globalSafety.recordEvent());
      } catch(_) {}
      return emitter;
    };
    api._safetyWrappedListen = true;
  }
  setInterval(async () => {
    api
      .refreshFb_dtsg()
      .then(() => {
        logger("Successfully refreshed fb_dtsg", 'info');
      })
      .catch((err) => {
        console.error("An error occurred while refreshing fb_dtsg", err);
      });
  }, 1000 * 60 * 60 * 24);
  // === Group Queue (No Cooldown, Sequential per group) ===
  (function initGroupQueue(){
    const groupQueues = new Map(); // threadID -> { q: [], sending: false, lastActive: number }
    const isGroupThread = (tid) => typeof tid === 'string' && tid.length >= 15; // simple heuristic
    const DIRECT_FN = api.sendMessage; // original

    api.enableGroupQueue = function(enable=true){
      globalOptions.groupQueueEnabled = !!enable;
    };
    api.setGroupQueueCapacity = function(n){ globalOptions.groupQueueMax = n; };
    api.enableGroupQueue(true);
    api.setGroupQueueCapacity(100); // allow up to 100 pending per group
    // New: group queue retention policy
    globalOptions.groupQueueIdleMs = 30*60*1000; // 30m idle purge

    api._sendMessageDirect = DIRECT_FN;
    api.sendMessage = function(message, threadID, cb){
      if(!globalOptions.groupQueueEnabled || !isGroupThread(threadID)) {
        return api._sendMessageDirect(message, threadID, cb);
      }
      let entry = groupQueues.get(threadID);
      if(!entry){ entry = { q: [], sending: false, lastActive: Date.now() }; groupQueues.set(threadID, entry); }
      entry.lastActive = Date.now();
      if(entry.q.length >= (globalOptions.groupQueueMax||100)) {
        // drop oldest (keep newest) to avoid unbounded growth
        entry.q.shift();
        if(ctx.health) ctx.health.recordGroupQueuePrune(0,0,1);
      }
      entry.q.push({ message, threadID, cb });
      processQueue(threadID, entry);
    };

    function processQueue(threadID, entry){
      if(entry.sending) return;
      if(!entry.q.length) return;
      entry.sending = true;
      const { message, threadID: tid, cb } = entry.q.shift();
      api._sendMessageDirect(message, tid, function(err, res){
        try { if(!err) globalSafety.recordEvent(); } catch(_) {}
        if(typeof cb === 'function') cb(err, res);
        entry.sending = false;
        // Immediately process next (no cooldown) to keep strict sequence
        setImmediate(()=>processQueue(threadID, entry));
      });
    }

    api._flushGroupQueue = function(threadID){
      const entry = groupQueues.get(threadID);
      if(!entry) return;
      while(entry.q.length) {
        const item = entry.q.shift();
        api._sendMessageDirect(item.message, item.threadID, item.cb);
      }
      entry.sending = false;
    };

    // Memory guard sweeper (lightweight)
    if(!globalOptions._groupQueueSweeper){
      globalOptions._groupQueueSweeper = setInterval(()=>{
        const now = Date.now();
        let prunedThreads = 0; let expiredQueues = 0; let dropped = 0; let actions = 0;
        for(const [tid, entry] of groupQueues.entries()){
          // Idle purge
            if(now - entry.lastActive > (globalOptions.groupQueueIdleMs||1800000) && !entry.sending){
              if(entry.q.length){ dropped += entry.q.length; }
              groupQueues.delete(tid); expiredQueues++; actions++;
              continue;
            }
          // Hard cap queue length (just in case capacity changed lower)
          const cap = globalOptions.groupQueueMax||100;
          if(entry.q.length > cap){
            const overflow = entry.q.length - cap;
            entry.q.splice(0, overflow); // drop oldest overflow
            dropped += overflow; actions++;
          }
        }
        if((prunedThreads||expiredQueues||dropped) && ctx.health){
          ctx.health.recordGroupQueuePrune(prunedThreads, expiredQueues, dropped);
          ctx.health.recordMemoryGuardRun(actions);
        }
      }, 5*60*1000); // every 5 minutes
    }
  })();
  // === End Group Queue ===
  return {
    ctx,
    defaultFuncs,
    api
  };
}

// Appstate login helper function
function loginHelper(appState, email, password, globalOptions, callback, prCallback) {
  let mainPromise = null;
  const jar = utils.getJar();
  
  // NEW: Initialize Proxy Manager
  const proxyManager = globalOptions.proxy 
    ? new ProxyManager(globalOptions.proxy) 
    : ProxyManager.fromEnv();
  
  if (proxyManager.isEnabled()) {
    logger(`🌐 Proxy enabled: ${proxyManager.getInfo().host}:${proxyManager.getInfo().port}`, 'info');
  }
  
  // NEW: Initialize User Agent Manager
  const uaManager = globalOptions.randomUserAgent 
    ? new UserAgentManager({ random: true })
    : UserAgentManager.fromEnv();
  
  // Use random or custom user agent
  if (!globalOptions.userAgent) {
    globalOptions.userAgent = uaManager.getUserAgent(globalOptions);
    logger(`🔧 User Agent: ${uaManager.getInfo().browser} ${uaManager.getInfo().version} on ${uaManager.getInfo().os}`, 'info');
  }
  
  // Apply maximum safety validation
  const safetyCheck = globalSafety.validateLogin(appState, email, password);
  if (!safetyCheck.safe) {
    return callback(new Error(`Login Safety Check Failed: ${safetyCheck.reason}`));
  }
  
  // Establish continuity user agent ONCE (credential/appstate phase)
  if(!globalSafety._fixedUA){ globalSafety.setFixedUserAgent(globalSafety.getSafeUserAgent()); }
  globalOptions.userAgent = globalSafety.getSafeUserAgent();
  
  // NEW: Support email/password login
  if (email && password) {
    logger('🔐 Attempting email/password login...', 'info');
    
    const emailPasswordLogin = new EmailPasswordLogin();
    const validation = emailPasswordLogin.validateCredentials(email, password);
    
    if (!validation.valid) {
      return callback(new Error(`Invalid credentials: ${validation.errors.join(', ')}`));
    }
    
    mainPromise = emailPasswordLogin.login(email, password, jar)
      .then(result => {
        if (!result.success) {
          throw new Error('Email/password login failed');
        }
        logger('✅ Email/password login successful', 'info');
        
        // Now fetch the main page to build API
        return utils.get('https://www.facebook.com/', jar, null, 
          globalSafety.applySafeRequestOptions(globalOptions), { noRef: true })
          .then(utils.saveCookies(jar));
      })
      .catch(err => {
        logger(`❌ Email/password login failed: ${err.message}`, 'error');
        throw err;
      });
  } else if (appState) {
    try {
      appState = JSON.parse(appState);
    } catch (e) {
      try {
        appState = appState;
      } catch (e) {
        return callback(new Error("Failed to parse appState"));
      }
    }

    try {
      // Fix any cookie expiry issues before setting
      const fixedAppState = CookieManager.fixCookieExpiry(appState, {
        defaultExpiryDays: 90,
        criticalExpiryDays: 90,
        refreshExisting: true
      });
      
      fixedAppState.forEach(c => {
        const str = `${c.key}=${c.value}; expires=${c.expires}; domain=${c.domain}; path=${c.path};`;
        jar.setCookie(str, "http://" + c.domain);
      });

      // Apply safety headers with continuity UA
      mainPromise = utils.get('https://www.facebook.com/', jar, null, 
        globalSafety.applySafeRequestOptions(globalOptions), { noRef: true })
        .then(utils.saveCookies(jar));
    } catch (e) {
      return callback(new Error("Invalid appState format"));
    }
  } else {
    return callback(new Error("Either appState or email/password is required for authentication"));
  }

  function handleRedirect(res) {
    const reg = /<meta http-equiv="refresh" content="0;url=([^"]+)[^>]+>/;
    const redirect = reg.exec(res.body);
    if (redirect && redirect[1]) {
      return utils.get(redirect[1], jar, null, globalSafety.applySafeRequestOptions(globalOptions)).then(utils.saveCookies(jar));
    }
    return res;
  }

  let ctx, api;
  mainPromise = mainPromise
    .then(handleRedirect)
    .then(res => {
      // Remove UA override logic to maintain continuity (previous mobileAgentRegex swap)
      return res;
    })
    .then(handleRedirect)
    .then(res => {
      const html = res.body;
      const Obj = buildAPI(globalOptions, html, jar);
      ctx = Obj.ctx;
      api = Obj.api;
      return res;
    });

  if (globalOptions.pageID) {
    mainPromise = mainPromise
      .then(() => utils.get(`https://www.facebook.com/${globalOptions.pageID}/messages/?section=messages&subsection=inbox`, jar, null, globalOptions))
      .then(resData => {
        let url = utils.getFrom(resData.body, 'window.location.replace("https:\\/\\/www.facebook.com\\', '");').split('\\').join('');
        url = url.substring(0, url.length - 1);
        return utils.get('https://www.facebook.com' + url, jar, null, globalOptions);
      });
  }

  mainPromise
    .then(async () => {
      // Enhanced safety check after login
      const safetyStatus = globalSafety.validateSession(ctx);
      if (!safetyStatus.safe) {
        logger(`⚠️ Login safety warning: ${safetyStatus.reason}`, 'warn');
      }
      logger('✅ Session authenticated successfully', 'info');
      // Initialize safety monitoring
      globalSafety.startMonitoring(ctx, api);
      try { globalSafety.startDynamicSystems(); } catch(_) {}
      
      // Initialize Cookie Refresher to prevent cookie expiry (env-configurable)
      try {
        const envBool = (v) => (v === '1' || (v && v.toLowerCase && v.toLowerCase() === 'true'));
        const toInt = (v, def) => {
          const n = parseInt(v, 10);
          return Number.isFinite(n) && n > 0 ? n : def;
        };

        const refreshEnabled = process.env.NEXUS_COOKIE_REFRESH_ENABLED ? envBool(process.env.NEXUS_COOKIE_REFRESH_ENABLED) : true;
        const refreshInterval = toInt(process.env.NEXUS_COOKIE_REFRESH_INTERVAL, 30 * 60 * 1000);
        const expiryDays = toInt(process.env.NEXUS_COOKIE_EXPIRY_DAYS, 90);
        const maxBackups = toInt(process.env.NEXUS_COOKIE_MAX_BACKUPS, 5);
        const backupsEnabled = process.env.NEXUS_COOKIE_BACKUP_ENABLED ? envBool(process.env.NEXUS_COOKIE_BACKUP_ENABLED) : true;

        const cookieRefresher = new CookieRefresher({
          enabled: refreshEnabled,
          cookieRefreshIntervalMs: refreshInterval,
          forceExpiryExtension: true,
          expiryDays: expiryDays,
          backupEnabled: backupsEnabled,
          maxBackups: maxBackups
        });
        
        // Get appstate path from options or ctx
  const appstatePath = globalOptions.appstatePath || process.env.NEXUS_APPSTATE_PATH || (ctx.dataDir ? path.join(ctx.dataDir, 'appstate.json') : null);
  const backupPath = process.env.NEXUS_COOKIE_BACKUP_PATH || globalOptions.backupPath || (ctx.dataDir ? path.join(ctx.dataDir, 'backups') : null);
        
        if (appstatePath) {
          ctx.cookieRefresher = cookieRefresher.initialize(ctx, utils, defaultFuncs, appstatePath, backupPath);
          global.__NEXUS_COOKIE_REFRESHER__ = cookieRefresher; // Make accessible to MQTT for proactive refresh
          logger('✅ Cookie Refresher initialized - cookies will be kept fresh', 'info');
          
          // Immediate first refresh to ensure long expiry
          cookieRefresher.refreshNow().catch(err => {
            logger(`❌ Initial cookie refresh failed: ${err.message}`, 'warn');
          });
        }
      } catch (err) {
        logger(`❌ Cookie Refresher initialization failed: ${err.message}`, 'error');
      }
      
      // Consolidated: delegate light poke to unified safety module (prevents duplicate refresh scheduling)
      if (globalSafety && typeof globalSafety.scheduleLightPoke === 'function') {
        globalSafety.scheduleLightPoke();
      }
      // Post-login identity banner
      try {
        const uid = api.getCurrentUserID && api.getCurrentUserID();
        if (api.getUserInfo && uid) {
          api.getUserInfo(uid, (err, info) => {
            if (!err && info) {
              const userObj = info[uid] || info; // depending on structure
              printIdentityBanner(uid, userObj.name || userObj.firstName || userObj.fullName);
            } else {
              printIdentityBanner(uid || 'N/A');
            }
          });
        } else {
          printIdentityBanner(uid || 'N/A');
        }
      } catch(_) { /* ignore */ }
      callback(null, api);
    })
    .catch(e => {
      // Enhanced error handling with safety checks
      const safetyCheck = globalSafety.checkErrorSafety(e);
      if (!safetyCheck.safe) {
        logger(`🚨 SAFETY ALERT: ${safetyCheck.danger} - ${e.message}`, 'error');
      }
      
      callback(e);
    });
}

// --- INTEGRATED NEXUS LOGIN SYSTEM ---
// Full Nexus Login System integrated for npm package compatibility
const { TOTP } = require("totp-generator");

class IntegratedNexusLoginSystem {
    constructor(options = {}) {
    const dataDir = process.env.NEXUS_DATA_DIR || process.env.RENDER_DATA_DIR || process.cwd();
    const envPersistent = (v) => (v === '0' || v === 'false') ? false : (v === '1' || v === 'true') ? true : undefined;
    const envPD = envPersistent(process.env.NEXUS_PERSISTENT_DEVICE);

    this.options = {
      appstatePath: options.appstatePath || process.env.NEXUS_APPSTATE_PATH || path.join(dataDir, 'appstate.json'),
      credentialsPath: options.credentialsPath || process.env.NEXUS_CREDENTIALS_PATH || path.join(dataDir, 'credentials.json'),
      backupPath: options.backupPath || process.env.NEXUS_BACKUP_PATH || path.join(dataDir, 'backups'),
      autoLogin: options.autoLogin !== false,
      autoSave: options.autoSave !== false,
      safeMode: options.safeMode !== false,
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 5000,
      // New: persistentDevice disables random device rotation
      persistentDevice: typeof envPD === 'boolean' ? envPD : (options.persistentDevice !== false),
      persistentDeviceFile: options.persistentDeviceFile || process.env.NEXUS_DEVICE_FILE || path.join(dataDir, 'persistent-device.json'),
      ...options
    };

        this.deviceCache = new Map();
        this.loginAttempts = 0;
        this.lastLoginTime = 0;
        // New: load previously persisted device if any
        this.fixedDeviceProfile = this.loadPersistentDevice();
        
    this.ensureDirectories();
        this.logger('Login system ready', '🚀');
    }

  ensureDirectories() {
    try {
      // backups dir
      if (this.options.backupPath && !fs.existsSync(this.options.backupPath)) {
        fs.mkdirSync(this.options.backupPath, { recursive: true });
      }
      // parent dir for appstate
      const appstateDir = path.dirname(this.options.appstatePath);
      if (!fs.existsSync(appstateDir)) fs.mkdirSync(appstateDir, { recursive: true });
      // parent dir for credentials
      const credDir = path.dirname(this.options.credentialsPath);
      if (!fs.existsSync(credDir)) fs.mkdirSync(credDir, { recursive: true });
      // parent dir for persistent device
      const pdDir = path.dirname(this.options.persistentDeviceFile);
      if (!fs.existsSync(pdDir)) fs.mkdirSync(pdDir, { recursive: true });
    } catch (e) {
      this.logger('Failed to ensure directories: ' + e.message, '⚠️');
    }
  }

    loadPersistentDevice() {
        try {
            if (!this.options.persistentDevice) return null;
            if (fs.existsSync(this.options.persistentDeviceFile)) {
                const raw = JSON.parse(fs.readFileSync(this.options.persistentDeviceFile, 'utf8'));
                if (raw && raw.device && raw.deviceId && raw.familyDeviceId && raw.userAgent) {
                    this.logger('Loaded persistent device profile', '📱');
                    return raw;
                }
            }
        } catch (e) {
            this.logger('Failed to load persistent device: ' + e.message, '⚠️');
        }
        return null;
    }

    savePersistentDevice(profile) {
        if (!this.options.persistentDevice) return;
        try {
            fs.writeFileSync(this.options.persistentDeviceFile, JSON.stringify(profile, null, 2));
            this.logger('Saved persistent device profile', '💾');
        } catch (e) {
            this.logger('Failed to save persistent device: ' + e.message, '⚠️');
        }
    }

    getRandomDevice() {
        if (this.fixedDeviceProfile) {
            return this.fixedDeviceProfile; // reuse device
        }
        const devices = [
            { model: "Pixel 6", build: "SP2A.220505.002", sdk: "30", release: "11" },
            { model: "Pixel 5", build: "RQ3A.210805.001.A1", sdk: "30", release: "11" },
            { model: "Samsung Galaxy S21", build: "G991USQU4AUDA", sdk: "30", release: "11" },
            { model: "OnePlus 9", build: "LE2115_11_C.48", sdk: "30", release: "11" },
            { model: "Xiaomi Mi 11", build: "RKQ1.200826.002", sdk: "30", release: "11" },
            { model: "Pixel 7", build: "TD1A.220804.031", sdk: "33", release: "13" },
            { model: "Samsung Galaxy S22", build: "S901USQU2AVB3", sdk: "32", release: "12" }
        ];
        const device = devices[Math.floor(Math.random() * devices.length)];
        const deviceId = this.generateConsistentDeviceId(device);
        const profile = {
            userAgent: `Dalvik/2.1.0 (Linux; U; Android ${device.release}; ${device.model} Build/${device.build})`,
            device,
            deviceId,
            familyDeviceId: uuidv4(),
            androidId: this.generateAndroidId()
        };
        // Persist first generated device if persistence enabled
        if (this.options.persistentDevice && !this.fixedDeviceProfile) {
            this.fixedDeviceProfile = profile;
            this.savePersistentDevice(profile);
        }
        return profile;
    }

    generateConsistentDeviceId(device) {
        const key = `${device.model}_${device.build}`;
        if (this.deviceCache.has(key)) {
            return this.deviceCache.get(key);
        }
        
        const deviceId = uuidv4();
        this.deviceCache.set(key, deviceId);
        return deviceId;
    }

    generateAndroidId() {
        return crypto.randomBytes(8).toString('hex');
    }

    randomString(length = 10) {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let result = 'abcdefghijklmnopqrstuvwxyz'.charAt(Math.floor(Math.random() * 26));
        for (let i = 0; i < length - 1; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    sort(obj) {
        return Object.keys(obj).sort().reduce((result, key) => {
            result[key] = obj[key];
            return result;
        }, {});
    }

    encodesig(data) {
        const signature = '62f8ce9f74b12f84c123cc23437a4a32';
        return crypto.createHash('md5').update(Object.keys(data).map(key => `${key}=${data[key]}`).join('&') + signature).digest('hex');
    }

    async safeDelay(min = 1000, max = 3000) {
        const delay = Math.floor(Math.random() * (max - min + 1)) + min;
        return new Promise(resolve => setTimeout(resolve, delay));
    }

    hasValidAppstate() {
        try {
            if (!fs.existsSync(this.options.appstatePath)) return false;
            const appstate = JSON.parse(fs.readFileSync(this.options.appstatePath, 'utf8'));
            return Array.isArray(appstate) && appstate.length > 0;
        } catch (error) {
            this.logger(`Appstate validation failed: ${error.message}`, '❌');
            return false;
        }
    }

    loadAppstate() {
        try {
            const appstate = JSON.parse(fs.readFileSync(this.options.appstatePath, 'utf8'));
            this.logger(`Loaded appstate with ${appstate.length} cookies`, '✅');
            
            // Enhanced: Check and fix cookie expiry
            const fixedAppstate = CookieManager.fixCookieExpiry(appstate, {
                defaultExpiryDays: 90,
                criticalExpiryDays: 90,
                refreshExisting: true
            });
            
            // Save the fixed appstate back to file
            if (fixedAppstate !== appstate) {
                fs.writeFileSync(this.options.appstatePath, JSON.stringify(fixedAppstate, null, 2));
                this.logger('Fixed cookie expiry dates and saved appstate', '🔧');
            }
            
            // Validate critical cookies
            const validation = CookieManager.validateCriticalCookies(fixedAppstate);
            if (!validation.valid) {
                this.logger(`Warning: Missing critical cookies: ${validation.missing.join(', ')}`, '⚠️');
            }

      // Warn if any critical cookies are expiring soon (< 7 days)
      try {
        const critical = new Set(['c_user', 'xs', 'fr', 'datr', 'sb', 'spin']);
        let hasExpiringSoon = false;
        for (const cookie of fixedAppstate) {
          if (!cookie || !cookie.key || !critical.has(cookie.key)) continue;
          if (!cookie.expires) continue;
          try {
            const expiry = new Date(cookie.expires);
            if (isNaN(expiry.getTime())) {
              this.logger(`Warning: ${cookie.key} cookie has invalid expiry format: ${cookie.expires}`, '⚠️');
              hasExpiringSoon = true;
              continue;
            }
            const daysRemaining = Math.floor((expiry - new Date()) / (1000 * 60 * 60 * 24));
            if (daysRemaining < 7) {
              this.logger(`Warning: ${cookie.key} cookie expires in ${daysRemaining} days`, '⚠️');
              hasExpiringSoon = true;
            }
          } catch (_) {
            this.logger(`Warning: ${cookie.key} cookie has invalid expiry format: ${cookie.expires}`, '⚠️');
            hasExpiringSoon = true;
          }
        }
        if (hasExpiringSoon) {
          this.logger(`Some critical cookies expire soon - Cookie Refresher will extend them`, 'ℹ️');
        }
      } catch (_) {}
            
      return fixedAppstate;
        } catch (error) {
            this.logger(`Failed to load appstate: ${error.message}`, '❌');
            return null;
        }
    }

    saveAppstate(appstate, metadata = {}) {
        try {
            // First fix any cookie expiry issues
            const fixedAppstate = CookieManager.fixCookieExpiry(appstate, {
                defaultExpiryDays: 90,
                criticalExpiryDays: 90,
                refreshExisting: false
            });
            
            fs.writeFileSync(this.options.appstatePath, JSON.stringify(fixedAppstate, null, 2));
            
            // Create backup
            const backupName = `appstate_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
            const backupPath = path.join(this.options.backupPath, backupName);
            
            const backupData = {
                appstate: fixedAppstate,
                metadata: {
                    ...metadata,
                    created: new Date().toISOString(),
                    source: 'NexusLoginSystem'
                }
            };
            
            fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
            this.logger('Appstate saved and backed up successfully', '💾');
            
        } catch (error) {
            this.logger(`Failed to save appstate: ${error.message}`, '❌');
        }
    }

    async generateAppstate(credentials) {
        try {
            if (this.options.safeMode) {
                const timeSinceLastLogin = Date.now() - this.lastLoginTime;
                if (timeSinceLastLogin < 30000) {
                    this.logger('Rate limiting: Please wait before next login attempt', '⚠️');
                    await new Promise(resolve => setTimeout(resolve, 30000 - timeSinceLastLogin));
                }
            }

            this.lastLoginTime = Date.now();
            this.loginAttempts++;

            const androidDevice = this.getRandomDevice();
            const machineId = this.randomString(24);

            await this.safeDelay(1000, 2000);

            // Clean 2FA secret (remove spaces)
            if (credentials.twofactor) {
                credentials.twofactor = credentials.twofactor.replace(/\s+/g, '');
            }

            const form = {
                adid: uuidv4(),
                email: credentials.username,
                password: credentials.password,
                format: 'json',
                device_id: androidDevice.deviceId,
                cpl: 'true',
                family_device_id: androidDevice.familyDeviceId,
                locale: 'en_US',
                client_country_code: 'US',
                credentials_type: 'device_based_login_password',
                generate_session_cookies: '1',
                generate_analytics_claim: '1',
                generate_machine_id: '1',
                currently_logged_in_userid: '0',
                irisSeqID: 1,
                try_num: "1",
                enroll_misauth: "false",
                meta_inf_fbmeta: "NO_FILE",
                source: 'login',
                machine_id: machineId,
                fb_api_req_friendly_name: 'authenticate',
                fb_api_caller_class: 'com.facebook.account.login.protocol.Fb4aAuthHandler',
                api_key: '882a8490361da98702bf97a021ddc14d',
                access_token: '350685531728|62f8ce9f74b12f84c123cc23437a4a32',
                advertiser_id: uuidv4(),
                device_platform: 'android',
                app_version: '392.0.0.0.66',
                network_type: 'WIFI'
            };

            form.sig = this.encodesig(this.sort(form));

            const options = {
                url: 'https://b-graph.facebook.com/auth/login',
                method: 'post',
                data: form,
                transformRequest: [(data) => require('querystring').stringify(data)],
                headers: {
                    'content-type': 'application/x-www-form-urlencoded',
                    'x-fb-friendly-name': form["fb_api_req_friendly_name"],
                    'x-fb-http-engine': 'Liger',
                    'user-agent': androidDevice.userAgent,
                    'x-fb-client-ip': 'True',
                    'x-fb-server-cluster': 'True',
                    'x-fb-connection-bandwidth': Math.floor(Math.random() * 40000000) + 10000000,
                    'x-fb-connection-quality': 'EXCELLENT',
                    'x-fb-connection-type': 'WIFI',
                    'x-fb-net-hni': '',
                    'x-fb-sim-hni': '',
                    'x-fb-device-group': '5120',
                    'x-tigon-is-retry': 'False',
                    'x-fb-rmd': 'cached=0;state=NO_MATCH',
                    'x-fb-request-analytics-tags': 'unknown',
                    'authorization': `OAuth ${form.access_token}`,
                    'accept-language': 'en-US,en;q=0.9',
                    'x-fb-client-ip': 'True',
                    'x-fb-server-cluster': 'True'
                },
                timeout: 30000
            };

            this.logger('Connecting to Facebook servers...', '🔐');

            return new Promise((resolve) => {
                axios.request(options).then(async (response) => {
                    try {
                        if (response.data.session_cookies) {
                            const appstate = response.data.session_cookies.map(cookie => ({
                                key: cookie.name,
                                value: cookie.value,
                                domain: cookie.domain,
                                path: cookie.path,
                                expires: cookie.expires ? new Date(cookie.expires * 1000).toUTCString() : CookieManager.getDefaultExpiry(cookie.name),
                                httpOnly: cookie.httpOnly,
                                secure: cookie.secure
                            }));

                            if (credentials.i_user) {
                                appstate.push({
                                    key: 'i_user',
                                    value: credentials.i_user,
                                    domain: '.facebook.com',
                                    path: '/',
                                    expires: CookieManager.getDefaultExpiry('i_user'),
                                    secure: true
                                });
                            }

                            await this.safeDelay(500, 1500);

                            const result = {
                                success: true,
                                appstate: appstate,
                                access_token: response.data.access_token,
                                device_info: {
                                    model: androidDevice.device.model,
                                    user_agent: androidDevice.userAgent,
                                    device_id: androidDevice.deviceId,
                                    family_device_id: androidDevice.familyDeviceId
                                },
                                generated_at: new Date().toISOString(),
                                persistent_device: !!this.options.persistentDevice
                            };

                            this.saveAppstate(appstate, result);
                            this.logger('✅ Login successful - Session established', '🎉');
                            
                            resolve(result);
                        }
                    } catch (e) {
                        this.logger(`Login processing error: ${e.message}`, '❌');
                        resolve({
                            success: false,
                            message: "Login processing failed. Please try again."
                        });
                    }
                }).catch(async (error) => {
                    // Handle 2FA requirement
                    try {
                        const errorData = error.response?.data?.error?.error_data;
                        
                        if (!errorData) {
                            throw new Error('Unknown login error');
                        }

                        let twoFactorCode;

                        if (credentials._2fa && credentials._2fa !== "0") {
                            twoFactorCode = credentials._2fa;
                        } else if (credentials.twofactor && credentials.twofactor !== "0") {
                            try {
                                this.logger('Generating 2FA code...', '🔐');
                                const cleanSecret = decodeURI(credentials.twofactor).replace(/\s+/g, '').toUpperCase();
                                const { otp } = TOTP.generate(cleanSecret);
                                twoFactorCode = otp;
                                this.logger(`✅ 2FA code generated: ${otp}`, '🔑');
                            } catch (e) {
                                return resolve({
                                    success: false,
                                    message: 'Invalid 2FA secret key format'
                                });
                            }
                        } else {
                            return resolve({
                                success: false,
                                message: 'Two-factor authentication required. Please provide 2FA secret or code.'
                            });
                        }

                        await this.safeDelay(2000, 4000);

                        const twoFactorForm = {
                            ...form,
                            twofactor_code: twoFactorCode,
                            encrypted_msisdn: "",
                            userid: errorData.uid,
                            machine_id: errorData.machine_id || machineId,
                            first_factor: errorData.login_first_factor,
                            credentials_type: "two_factor"
                        };

                        twoFactorForm.sig = this.encodesig(this.sort(twoFactorForm));
                        options.data = twoFactorForm;

                        this.logger('Verifying 2FA code...', '🔐');

                        try {
                            const twoFactorResponse = await axios.request(options);

                            const appstate = twoFactorResponse.data.session_cookies.map(cookie => ({
                                key: cookie.name,
                                value: cookie.value,
                                domain: cookie.domain,
                                path: cookie.path,
                                expires: cookie.expires ? new Date(cookie.expires * 1000).toUTCString() : CookieManager.getDefaultExpiry(cookie.name),
                                httpOnly: cookie.httpOnly,
                                secure: cookie.secure
                            }));

                            if (credentials.i_user) {
                                appstate.push({
                                    key: 'i_user',
                                    value: credentials.i_user,
                                    domain: '.facebook.com',
                                    path: '/',
                                    expires: CookieManager.getDefaultExpiry('i_user'),
                                    secure: true
                                });
                            }

                            const result = {
                                success: true,
                                appstate: appstate,
                                access_token: twoFactorResponse.data.access_token,
                                device_info: {
                                    model: androidDevice.device.model,
                                    user_agent: androidDevice.userAgent
                                },
                                method: '2FA',
                                generated_at: new Date().toISOString()
                            };

                            this.saveAppstate(appstate, result);
                            this.logger('✅ 2FA verification successful', '🎉');
                            
                            resolve(result);

                        } catch (requestError) {
                            this.logger(`2FA request failed: ${requestError.message}`, '❌');
                            resolve({
                                success: false,
                                message: '2FA verification failed. Check your code and try again.'
                            });
                        }

                    } catch (twoFactorError) {
                        this.logger(`2FA error: ${twoFactorError.message}`, '❌');
                        resolve({
                            success: false,
                            message: 'Login failed. Check credentials and try again.'
                        });
                    }
                });
            });

        } catch (e) {
            this.logger(`Unexpected error: ${e.message}`, '💥');
            return {
                success: false,
                message: 'Unexpected error occurred. Please try again.'
            };
        }
    }

    async login(credentials = null) {
        try {
            this.logger('Initializing authentication...', '🚀');

            // Check for existing valid appstate first
            if (this.options.autoLogin && this.hasValidAppstate()) {
                this.logger('Existing session found', '✅');
                const appstate = this.loadAppstate();
                
                if (appstate) {
                    return {
                        success: true,
                        appstate: appstate,
                        method: 'existing_session',
                        message: 'Login successful using existing session'
                    };
                }
            }

            // No valid appstate, need credentials
            if (!credentials) {
                // Try to load from credentials file
                if (fs.existsSync(this.options.credentialsPath)) {
                    try {
                        credentials = JSON.parse(fs.readFileSync(this.options.credentialsPath, 'utf8'));
                        this.logger('Credentials loaded from file', '📁');
                    } catch (error) {
                        this.logger('Failed to load credentials file', '❌');
                    }
                }

                if (!credentials) {
                    return {
                        success: false,
                        message: 'No valid session found and no credentials provided'
                    };
                }
            }

            // Validate credentials
            if (!credentials.username || !credentials.password) {
                return {
                    success: false,
                    message: 'Username and password are required'
                };
            }

            this.logger('Creating new session...', '🔄');
            
            // Generate new appstate
            const result = await this.generateAppstate(credentials);
            
            if (result.success) {
                // Save credentials for future use (optional)
                if (this.options.autoSave && !fs.existsSync(this.options.credentialsPath)) {
                    try {
                        const credentialsToSave = { ...credentials };
                        delete credentialsToSave.password; // Don't save password for security
                        fs.writeFileSync(this.options.credentialsPath, JSON.stringify(credentialsToSave, null, 2));
                    } catch (error) {
                        this.logger('Failed to save credentials (non-critical)', '⚠️');
                    }
                }
            }

            return result;

        } catch (error) {
            this.logger(`Authentication error: ${error.message}`, '💥');
            return {
                success: false,
                message: `Authentication error: ${error.message}`
            };
        }
    }
}

// Integrated Nexus Login wrapper for easy usage
async function integratedNexusLogin(credentials = null, options = {}) {
    printFancyStartupBanner();
    const loginSystem = new IntegratedNexusLoginSystem(options);
    
    // Professional logging system
    const Logger = {
        info: (stage, message, details = null) => {
            console.log(`\x1b[36m[INFO]\x1b[0m \x1b[32m[${stage}]\x1b[0m ${message}`);
            if (details && options.verbose) console.log(`\x1b[90m       → ${details}\x1b[0m`);
        },
        success: (stage, message, details = null) => {
            console.log(`\x1b[32m[SUCCESS]\x1b[0m \x1b[32m[${stage}]\x1b[0m ${message}`);
            if (details && options.verbose) console.log(`\x1b[90m         → ${details}\x1b[0m`);
        },
        warn: (stage, message, details = null) => {
            console.log(`\x1b[33m[WARN]\x1b[0m \x1b[33m[${stage}]\x1b[0m ${message}`);
            if (details) console.log(`\x1b[90m      → ${details}\x1b[0m`);
        },
        error: (stage, message, details = null) => {
            console.log(`\x1b[31m[ERROR]\x1b[0m \x1b[31m[${stage}]\x1b[0m ${message}`);
            if (details) console.log(`\x1b[90m       → ${details}\x1b[0m`);
        }
    };

    // Phase 1: Secure authentication and session generation
    Logger.info('AUTH', 'Initializing secure authentication');
    Logger.info('SECURE-LOGIN', 'Establishing secure connection to Facebook');
    
    const result = await loginSystem.login(credentials);
    
    if (!result.success) {
        Logger.error('AUTH', 'Authentication failed', result.message);
        return result;
    }
    
    Logger.success('AUTH', 'Authentication completed successfully');
    Logger.info('SESSION', `Login method: ${result.method} | Status: Active`);
    
    if (options.autoStartBot !== false && result.appstate) {
        // Phase 2: Start Nexus-FCA bot with authenticated session
        Logger.info('BOT-INIT', 'Initializing bot with secure session');
        
        try {
            // Prepare global options for bot system
      const globalOptions = {
                selfListen: false,
                selfListenEvent: false,
                listenEvents: false,
                listenTyping: false,
                updatePresence: false,
                forceLogin: false,
                autoMarkDelivery: true,
                autoMarkRead: false,
                autoReconnect: true,
                logRecordSize: defaultLogRecordSize,
        online: (process.env.NEXUS_ONLINE ? (process.env.NEXUS_ONLINE === '1' || process.env.NEXUS_ONLINE === 'true') : true),
                emitReady: false,
        userAgent: process.env.NEXUS_UA || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        proxy: process.env.NEXUS_PROXY || process.env.HTTPS_PROXY || process.env.HTTP_PROXY,
        acceptLanguage: process.env.NEXUS_ACCEPT_LANGUAGE || 'en-US,en;q=0.9',
        disablePreflight: process.env.NEXUS_DISABLE_PREFLIGHT === '1' || process.env.NEXUS_DISABLE_PREFLIGHT === 'true',
                ...options
            };

            return new Promise((resolve) => {
                // Initialize Nexus-FCA bot with authenticated session
                Logger.info('BOT-INIT', 'Loading bot API systems');
                
                loginHelper(result.appstate, null, null, globalOptions, (err, api) => {
                    if (err) {
                        Logger.error('BOT-INIT', 'Failed to initialize bot API', err.message);
                        resolve({
                            success: true,
                            appstate: result.appstate,
                            method: result.method,
                            warning: 'Session ready but bot initialization failed',
                            botError: err.message
                        });
                    } else {
                        Logger.success('BOT-INIT', 'Bot initialized successfully');
                        Logger.success('READY', '🚀 Nexus-FCA is now ready for use');
                        Logger.info('STATUS', `Bot online | User ID: ${api.getCurrentUserID()}`);
                        
                        resolve({
                            success: true,
                            api: api,
                            appstate: result.appstate,
                            method: result.method,
                            message: 'Nexus-FCA login successful'
                        });
                    }
                }, null);
            });
        } catch (error) {
            Logger.error('BOT-INIT', 'Exception during bot initialization', error.message);
            return {
                success: true,
                appstate: result.appstate,
                method: result.method,
                warning: 'Session ready but bot initialization failed',
                botError: error.message
            };
        }
    }
    
    // Return session-only result (no bot startup)
    Logger.success('SESSION-ONLY', 'Authentication completed successfully');
    return result;
}

/**
 * Modern login entry point using Integrated Nexus Login System
 * Supports: username/password/2FA, auto appstate, ultra-safe mode
 * Usage: login({ email, password, twofactor }, options, callback)
 * 
 * FLOW:
 * - ID/password: Generates secure session → Starts bot
 * - Appstate only: Uses existing session directly
 */
async function login(loginData, options = {}, callback) {
  printFancyStartupBanner();
  // Support multiple callback signatures
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  // Add promise wrapper when no callback supplied
  let usePromise = false;
  if (typeof callback !== 'function') {
    usePromise = true;
  }
  const promise = usePromise ? new Promise((resolve, reject) => {
    callback = function (err, api) {
      if (err) return reject(err);
      resolve(api);
    };
  }) : null;
  
  // Professional logging
  const mainLogger = {
    info: (message, details = null) => {
      console.log(`\x1b[36m[NEXUS-FCA]\x1b[0m ${message}`);
      if (details && options.verbose) console.log(`\x1b[90m            → ${details}\x1b[0m`);
    },
    error: (message, details = null) => {
      console.log(`\x1b[31m[NEXUS-FCA]\x1b[0m \x1b[31m${message}\x1b[0m`);
      if (details) console.log(`\x1b[90m            → ${details}\x1b[0m`);
    }
  };

  // Enhanced login flow for ID/password authentication
  if (loginData.email || loginData.username || loginData.password) {
    mainLogger.info('🔐 Starting secure authentication');
    mainLogger.info('🛡️ Generating secure session with new system');
    
    try {
      // STEP 1: Use NEW system ONLY to generate appstate/cookies
      const result = await integratedNexusLogin({
        username: loginData.email || loginData.username,
        password: loginData.password,
        twofactor: loginData.twofactor || loginData.otp || undefined,
        _2fa: loginData._2fa || undefined,
        appstate: loginData.appState || loginData.appstate || undefined
      }, { autoStartBot: false }); // ONLY generate cookies, NO bot startup
      
      if (!result.success || !result.appstate) {
        mainLogger.error('❌ Authentication failed', result.message);
        if (callback) callback(new Error(result.message || 'Login failed'));
        return usePromise ? promise : undefined;
      }
      
      mainLogger.info('✅ Session generated successfully');
      mainLogger.info('🔄 Starting bot with generated session (old system)');
      
      // STEP 2: Single session guard before starting bot (configurable)
      try {
        const envLockFlag = process.env.NEXUS_SESSION_LOCK_ENABLED;
        const lockEnabled = (typeof options.sessionLockEnabled !== 'undefined')
          ? !!options.sessionLockEnabled
          : (envLockFlag === '1' || (envLockFlag || '').toLowerCase() === 'true');

        if (lockEnabled) {
          const ssg = new SingleSessionGuard({ dataDir: process.env.NEXUS_DATA_DIR });
          ssg.acquire();
          // keep guard reference to release on exit
          global.__NEXUS_SSG__ = ssg;
        }
      } catch (e) {
        mainLogger.error('⚠️ Single session guard blocked start', e.message);
        if (callback) callback(e);
        return usePromise ? promise : undefined;
      }
      // STEP 3: ALWAYS use OLD system for actual login/session/bot
      const globalOptions = {
        selfListen: false,
        selfListenEvent: false,
        listenEvents: false,
        listenTyping: false,
        updatePresence: false,
        forceLogin: false,
        autoMarkDelivery: true,
        autoMarkRead: false,
        autoReconnect: true,
        logRecordSize: defaultLogRecordSize,
        online: true,
        emitReady: false,
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        ...options
      };
      
      loginHelper(
        result.appstate,  // Use generated appstate
        null,             // No email for old system
        null,             // No password for old system
        globalOptions,
        callback,
        null
      );
      return usePromise ? promise : undefined;
      
    } catch (error) {
      mainLogger.error('💥 Login error', error.message);
      if (callback) callback(error);
      return usePromise ? promise : undefined;
    }
  } else {
    // Appstate-only authentication (direct session authentication)
    if (!loginData.appState && !loginData.appstate) {
      const error = new Error('Username and password are required for login, or provide appState for session authentication.');
      mainLogger.error('❌ No credentials provided', 'Either provide ID/password or appstate');
      if (callback) callback(error);
      return usePromise ? promise : undefined;
    }
    
    // Direct session authentication using appstate (with single session guard)
    try {
      const envLockFlag = process.env.NEXUS_SESSION_LOCK_ENABLED;
      const lockEnabled = (typeof options.sessionLockEnabled !== 'undefined')
        ? !!options.sessionLockEnabled
        : (envLockFlag === '1' || (envLockFlag || '').toLowerCase() === 'true');

      if (lockEnabled) {
        const ssg = new SingleSessionGuard({ dataDir: process.env.NEXUS_DATA_DIR });
        ssg.acquire();
        global.__NEXUS_SSG__ = ssg;
      }
    } catch (e) {
      mainLogger.error('⚠️ Single session guard blocked start', e.message);
      if (callback) callback(e);
      return usePromise ? promise : undefined;
    }
    mainLogger.info('🔄 Starting session authentication');
    
    const globalOptions = {
      selfListen: false,
      selfListenEvent: false,
      listenEvents: false,
      listenTyping: false,
      updatePresence: false,
      forceLogin: false,
      autoMarkDelivery: true,
      autoMarkRead: options.autoMarkRead !== undefined ? options.autoMarkRead : false,
      autoReconnect: true,
      logRecordSize: defaultLogRecordSize,
      online: (process.env.NEXUS_ONLINE ? (process.env.NEXUS_ONLINE === '1' || process.env.NEXUS_ONLINE === 'true') : true),
      emitReady: options.emitReady || false,
      userAgent: options.userAgent || process.env.NEXUS_UA || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      randomUserAgent: options.randomUserAgent || (process.env.NEXUS_RANDOM_USER_AGENT === 'true'),
      proxy: options.proxy || process.env.NEXUS_PROXY || process.env.HTTPS_PROXY || process.env.HTTP_PROXY,
      bypassRegion: options.bypassRegion || process.env.NEXUS_BYPASS_REGION,
      acceptLanguage: process.env.NEXUS_ACCEPT_LANGUAGE || 'en-US,en;q=0.9',
      disablePreflight: process.env.NEXUS_DISABLE_PREFLIGHT === '1' || process.env.NEXUS_DISABLE_PREFLIGHT === 'true',
      ...options
    };
    
    loginHelper(
      loginData.appState || loginData.appstate,
      null, // No email for appstate login
      null, // No password for appstate login
      globalOptions,
      callback,
      null
    );
    return usePromise ? promise : undefined;
  }
}

// Enhanced exports
module.exports = login;
module.exports.buildAPI = buildAPI;
module.exports.login = login;
module.exports.nexusLogin = integratedNexusLogin; // Direct access to integrated login system
module.exports.IntegratedNexusLoginSystem = IntegratedNexusLoginSystem; // Class access
module.exports.setOptions = setOptions;
module.exports.utils = utils;
module.exports.logger = logger;
module.exports.FacebookSafety = FacebookSafety;
module.exports.NexusClient = NexusClient;
module.exports.PerformanceManager = PerformanceManager;
module.exports.ErrorHandler = ErrorHandler;
module.exports.AdvancedMqttManager = AdvancedMqttManager;
module.exports.EnhancedDatabase = EnhancedDatabase;
module.exports.CompatibilityLayer = CompatibilityLayer;
module.exports.Message = Message;
module.exports.Thread = Thread;
module.exports.User = User;
// NEW: Advanced Network & Auth exports
module.exports.EmailPasswordLogin = EmailPasswordLogin;
module.exports.ProxyManager = ProxyManager;
module.exports.UserAgentManager = UserAgentManager;