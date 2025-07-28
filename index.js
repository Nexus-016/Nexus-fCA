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

// Legacy login helper function for appstate-only login
function loginHelper(appState, email, password, globalOptions, callback, prCallback) {
  let mainPromise = null;
  const jar = utils.getJar();
  
  // Apply maximum safety validation
  const safetyCheck = globalSafety.validateLogin(appState, email, password);
  if (!safetyCheck.safe) {
    return callback(new Error(`Login Safety Check Failed: ${safetyCheck.reason}`));
  }
  
  // Apply safe user agent from safety module
  globalOptions.userAgent = globalSafety.getSafeUserAgent();
  
  if (appState) {
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
      appState.forEach(c => {
        const str = `${c.key}=${c.value}; expires=${c.expires}; domain=${c.domain}; path=${c.path};`;
        jar.setCookie(str, "http://" + c.domain);
      });

      // Apply safety headers and no delays for maximum safety
      mainPromise = utils.get('https://www.facebook.com/', jar, null, 
        globalSafety.applySafeRequestOptions(globalOptions), { noRef: true })
        .then(utils.saveCookies(jar));
    } catch (e) {
      return callback(new Error("Invalid appState format"));
    }
  } else {
    return callback(new Error("AppState is required for legacy login"));
  }

  function handleRedirect(res) {
    const reg = /<meta http-equiv="refresh" content="0;url=([^"]+)[^>]+>/;
    const redirect = reg.exec(res.body);
    if (redirect && redirect[1]) {
      return utils.get(redirect[1], jar, null, globalOptions).then(utils.saveCookies(jar));
    }
    return res;
  }

  let ctx, api;
  mainPromise = mainPromise
    .then(handleRedirect)
    .then(res => {
      const mobileAgentRegex = /MPageLoadClientMetrics/gs;
      if (!mobileAgentRegex.test(res.body)) {
        globalOptions.userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";
        return utils.get('https://www.facebook.com/', jar, null, globalOptions, { noRef: true }).then(utils.saveCookies(jar));
      }
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
      
      logger('Legacy login successful!', 'info');
      
      // Initialize safety monitoring
      globalSafety.startMonitoring(ctx, api);
      
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
const { v4: uuidv4 } = require('uuid');
const { TOTP } = require("totp-generator");
const crypto = require('crypto');

class IntegratedNexusLoginSystem {
    constructor(options = {}) {
        this.options = {
            appstatePath: options.appstatePath || path.join(process.cwd(), 'appstate.json'),
            credentialsPath: options.credentialsPath || path.join(process.cwd(), 'credentials.json'),
            backupPath: options.backupPath || path.join(process.cwd(), 'backups'),
            autoLogin: options.autoLogin !== false,
            autoSave: options.autoSave !== false,
            safeMode: options.safeMode !== false,
            maxRetries: options.maxRetries || 3,
            retryDelay: options.retryDelay || 5000,
            ...options
        };

        this.deviceCache = new Map();
        this.loginAttempts = 0;
        this.lastLoginTime = 0;
        
        this.ensureDirectories();
        this.logger('Nexus Login System initialized', '🚀');
    }

    logger(message, emoji = '📝') {
        const timestamp = new Date().toLocaleString();
        console.log(`${emoji} [${timestamp}] ${message}`);
    }

    ensureDirectories() {
        const dirs = [
            path.dirname(this.options.appstatePath),
            path.dirname(this.options.credentialsPath),
            this.options.backupPath
        ];
        
        dirs.forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }

    getRandomDevice() {
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
        
        return {
            userAgent: `Dalvik/2.1.0 (Linux; U; Android ${device.release}; ${device.model} Build/${device.build})`,
            device,
            deviceId,
            familyDeviceId: uuidv4(),
            androidId: this.generateAndroidId()
        };
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
            return appstate;
        } catch (error) {
            this.logger(`Failed to load appstate: ${error.message}`, '❌');
            return null;
        }
    }

    saveAppstate(appstate, metadata = {}) {
        try {
            fs.writeFileSync(this.options.appstatePath, JSON.stringify(appstate, null, 2));
            
            // Create backup
            const backupName = `appstate_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
            const backupPath = path.join(this.options.backupPath, backupName);
            
            const backupData = {
                appstate,
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

            this.logger('Attempting login with enhanced security...', '🔐');

            return new Promise((resolve) => {
                axios.request(options).then(async (response) => {
                    try {
                        if (response.data.session_cookies) {
                            const appstate = response.data.session_cookies.map(cookie => ({
                                key: cookie.name,
                                value: cookie.value,
                                domain: cookie.domain,
                                path: cookie.path,
                                expires: cookie.expires,
                                httpOnly: cookie.httpOnly,
                                secure: cookie.secure
                            }));

                            if (credentials.i_user) {
                                appstate.push({
                                    key: 'i_user',
                                    value: credentials.i_user,
                                    domain: '.facebook.com',
                                    path: '/'
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
                                    device_id: androidDevice.deviceId
                                },
                                generated_at: new Date().toISOString()
                            };

                            this.saveAppstate(appstate, result);
                            this.logger('Login successful! Appstate generated and saved', '🎉');
                            
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
                                this.logger('Processing 2FA with TOTP...', '🔐');
                                const cleanSecret = decodeURI(credentials.twofactor).replace(/\s+/g, '').toUpperCase();
                                const { otp } = TOTP.generate(cleanSecret);
                                twoFactorCode = otp;
                                this.logger(`Generated 2FA code: ${otp}`, '🔑');
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

                        this.logger('Attempting 2FA login...', '🔐');

                        try {
                            const twoFactorResponse = await axios.request(options);

                            const appstate = twoFactorResponse.data.session_cookies.map(cookie => ({
                                key: cookie.name,
                                value: cookie.value,
                                domain: cookie.domain,
                                path: cookie.path,
                                expires: cookie.expires,
                                httpOnly: cookie.httpOnly,
                                secure: cookie.secure
                            }));

                            if (credentials.i_user) {
                                appstate.push({
                                    key: 'i_user',
                                    value: credentials.i_user,
                                    domain: '.facebook.com',
                                    path: '/'
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
                            this.logger('2FA login successful! Appstate saved', '🎉');
                            
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
            this.logger('Starting Nexus Login System...', '🚀');

            // Check for existing valid appstate first
            if (this.options.autoLogin && this.hasValidAppstate()) {
                this.logger('Valid appstate found, loading...', '✅');
                const appstate = this.loadAppstate();
                
                if (appstate) {
                    return {
                        success: true,
                        appstate: appstate,
                        method: 'existing_appstate',
                        message: 'Login successful using existing appstate'
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
                        message: 'No valid appstate found and no credentials provided'
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

            this.logger('Generating new appstate...', '🔄');
            
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
            this.logger(`Login system error: ${error.message}`, '💥');
            return {
                success: false,
                message: `System error: ${error.message}`
            };
        }
    }
}

// Integrated Nexus Login wrapper for easy usage
async function integratedNexusLogin(credentials = null, options = {}) {
    const loginSystem = new IntegratedNexusLoginSystem(options);
    const result = await loginSystem.login(credentials);
    
    if (result.success && options.autoStartBot !== false) {
        // Auto-start Nexus-FCA with the generated appstate
        try {
            return new Promise((resolve) => {
                login({ appState: result.appstate }, options, (err, api) => {
                    if (err) {
                        resolve({
                            success: true,
                            appstate: result.appstate,
                            method: result.method,
                            warning: 'Appstate ready but bot startup failed',
                            botError: err.message
                        });
                    } else {
                        resolve({
                            success: true,
                            api: api,
                            appstate: result.appstate,
                            method: result.method,
                            message: 'Nexus-FCA bot started successfully'
                        });
                    }
                });
            });
        } catch (error) {
            return {
                success: true,
                appstate: result.appstate,
                method: result.method,
                warning: 'Appstate ready but bot startup failed',
                botError: error.message
            };
        }
    }
    
    return result;
}

/**
 * Modern login entry point using Integrated Nexus Login System
 * Supports: username/password/2FA, auto appstate, ultra-safe mode
 * Usage: login({ email, password, twofactor }, options, callback)
 */
async function login(loginData, options = {}, callback) {
  // Support legacy callback signature
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  
  // Use Integrated Nexus Login System for ID/pass login, or legacy for appstate-only
  if (loginData.email || loginData.username || loginData.password) {
    try {
      const result = await integratedNexusLogin({
        username: loginData.email || loginData.username,
        password: loginData.password,
        twofactor: loginData.twofactor || loginData.otp || undefined,
        _2fa: loginData._2fa || undefined,
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
      log.error('login', "Nexus Login System error: " + error.message);
      if (callback) return callback(error);
      throw error;
    }
  } else {
    // Legacy appstate-only login
    if (!loginData.appState && !loginData.appstate) {
      const error = new Error('Username and password are required for login, or provide appState for legacy login.');
      if (callback) return callback(error);
      throw error;
    }
    
    // Legacy appstate login
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
    
    return loginHelper(
      loginData.appState || loginData.appstate,
      null, // No email for appstate login
      null, // No password for appstate login
      globalOptions,
      callback,
      null
    );
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