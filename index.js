"use strict";
// Nexus-FCA: Advanced and Safe Facebook Chat API (Enhanced Version)
const utils = require("./utils");
const log = require("npmlog");
const { execSync } = require('child_process');
const { promises: fsPromises, readFileSync } = require('fs');
const fs = require('fs');
const axios = require('axios');
const path = require('path');
const models = require("./lib/database/models");
const logger = require("./lib/logger");
const { safeMode, ultraSafeMode, smartSafetyLimiter, isUserAllowed } = require('./utils'); // Enhanced safety system

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

// Legacy imports for backward compatibility
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
    wsTaskNumber: 0
  };
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
      // Simple health check: returns status and safeMode info
      callback(null, {
        status: 'ok',
        safeMode,
        time: new Date().toISOString(),
        userID: ctx.userID || null
      });
    },
  };
  const defaultFuncs = utils.makeDefaults(html, i_userID || userID, ctx);
  require("fs")
    .readdirSync(__dirname + "/src/")
    .filter((v) => v.endsWith(".js"))
    .map(function (v) {
      api[v.replace(".js", "")] = require("./src/" + v)(defaultFuncs, api, ctx);
    });
  api.listen = api.listenMqtt;
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
  return {
    ctx,
    defaultFuncs,
    api
  };
}

// --- REPLACE LEGACY LOGIN WITH NEXUS LOGIN SYSTEM ---
const { nexusLogin } = require('./nexloginsystem');

/**
 * Modern login entry point using Nexus Login System
 * Supports: username/password/2FA, auto appstate, ultra-safe mode
 * Usage: login({ email, password, twofactor }, options, callback)
 */
async function login(loginData, options = {}, callback) {
  // Support legacy callback signature
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  // Use Nexus Login System for all logins
  try {
    const result = await nexusLogin({
      username: loginData.email || loginData.username,
      password: loginData.password,
      twofactor: loginData.twofactor || loginData.otp || undefined,
      appstate: loginData.appState || loginData.appstate || undefined
    }, options);
    if (result.success && result.api) {
      if (callback) return callback(null, result.api);
      return result.api;
    } else {
      if (callback) return callback(new Error(result.message || 'Login failed'));
      throw new Error(result.message || 'Login failed');
    }
  } catch (error) {
    log.error('login', "Lỗi không xác định, vui lòng thử lại sau: " + error.message);
    if (callback) return callback(error);
  }
}

module.exports = {
  buildAPI,
  login,
  setOptions,
  utils,
  logger,
  FacebookSafety,
  CompatibilityLayer,
  PerformanceManager,
  ErrorHandler,
  AdvancedMqttManager,
  EnhancedDatabase,
  Message,
  Thread,
  User
};