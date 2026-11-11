"use strict";
/**
 * autoLogin.js - Session Recovery via Graph API
 * 
 * This module provides automatic session recovery when cookies expire.
 * Ported from fca-unofficial-main with enhancements for Nexus-fCA.
 */

const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");
const axios = require("axios");
const { CookieJar } = require("tough-cookie");
const { wrapper } = require("axios-cookiejar-support");
const qs = require("querystring");
const fs = require("fs");
const path = require("path");
const log = require("npmlog");

// Try to import TOTP generator
let TOTP;
try {
  TOTP = require("totp-generator").TOTP;
} catch (_) {
  try {
    const totpGen = require("totp-generator");
    TOTP = { generate: totpGen.TOTP ? totpGen.TOTP.generate : totpGen };
  } catch (__) {
    TOTP = null;
  }
}

const MESSENGER_USER_AGENT = "Dalvik/2.1.0 (Linux; U; Android 12; Pixel 6 Build/SP2A.220505.002) [FBAN/Orca-Android;FBAV/420.0.0.28.106;FBPN/com.facebook.orca;FBLC/en_US;FBBV/520000000;FBCR/T-Mobile;FBMF/Google;FBBD/Google;FBDV/Pixel 6;FBSV/12;FBCA/arm64-v8a:armeabi-v7a;FBDM/{density=2.625,width=1080,height=2400};FB_FW/1;]";

function md5(s) {
  return crypto.createHash("md5").update(s).digest("hex");
}

function randomString(length = 24) {
  let s = "abcdefghijklmnopqrstuvwxyz";
  let out = s.charAt(Math.floor(Math.random() * s.length));
  for (let i = 1; i < length; i++) out += "abcdefghijklmnopqrstuvwxyz0123456789".charAt(Math.floor(36 * Math.random()));
  return out;
}

function sortObject(o) {
  const keys = Object.keys(o).sort();
  const x = {};
  for (const k of keys) x[k] = o[k];
  return x;
}

function encodeSig(obj) {
  let data = "";
  for (const k of Object.keys(obj)) data += `${k}=${obj[k]}`;
  return md5(data + "62f8ce9f74b12f84c123cc23437a4a32");
}

/**
 * Generate TOTP code from secret
 * @param {string} secret - TOTP secret (with or without spaces)
 * @returns {Promise<string|null>} 6-digit code or null
 */
async function genTotp(secret) {
  if (!secret || !TOTP) return null;
  try {
    const cleaned = String(secret).replace(/\s+/g, "").toUpperCase();
    if (typeof TOTP.generate === "function") {
      const r = await TOTP.generate(cleaned);
      return typeof r === "object" ? r.otp : r;
    }
    return null;
  } catch (e) {
    log.warn("autoLogin", `TOTP generation failed: ${e.message}`);
    return null;
  }
}

/**
 * Set cookies from appstate into jar
 * @param {CookieJar} j - Cookie jar
 * @param {Array} appstate - Array of cookie objects
 */
async function setJarCookies(j, appstate) {
  const tasks = [];
  for (const c of appstate) {
    const cookieName = c.name || c.key;
    const cookieValue = c.value;
    if (!cookieName || cookieValue === undefined) continue;

    const cookieDomain = c.domain || ".facebook.com";
    const cookiePath = c.path || "/";
    const dom = cookieDomain.replace(/^\./, "");

    let expiresStr = "";
    if (c.expires) {
      const expiresDate = typeof c.expires === "number" ? new Date(c.expires) : new Date(c.expires);
      expiresStr = `; expires=${expiresDate.toUTCString()}`;
    } else {
      // Default to 1 year expiry
      const oneYear = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      expiresStr = `; expires=${oneYear.toUTCString()}`;
    }

    const str = `${cookieName}=${cookieValue}${expiresStr}; Domain=${cookieDomain}; Path=${cookiePath};`;

    const urls = [
      `http://${dom}${cookiePath}`,
      `https://${dom}${cookiePath}`,
      `http://www.${dom}${cookiePath}`,
      `https://www.${dom}${cookiePath}`
    ];

    for (const url of urls) {
      tasks.push(j.setCookie(str, url).catch(() => { }));
    }
  }
  await Promise.all(tasks);
}

/**
 * Login via Facebook Graph API (Android app flow)
 * @param {string} username - Facebook email/phone
 * @param {string} password - Facebook password
 * @param {string|null} twofactorSecretOrCode - 2FA secret or 6-digit code
 * @param {string|null} i_user - Optional i_user cookie value
 * @param {CookieJar|null} externalJar - Optional existing jar
 * @returns {Promise<Object>} Login result
 */
async function loginViaGraph(username, password, twofactorSecretOrCode = null, i_user = null, externalJar = null) {
  const cookieJar = externalJar instanceof CookieJar ? externalJar : new CookieJar();
  const client = wrapper(axios.create({ jar: cookieJar, withCredentials: true, timeout: 30000, validateStatus: () => true }));
  
  const device_id = uuidv4();
  const family_device_id = device_id;
  const machine_id = randomString(24);
  
  const base = {
    adid: uuidv4(),
    format: "json",
    device_id,
    email: username,
    password,
    generate_analytics_claim: "1",
    community_id: "",
    cpl: "true",
    try_num: "1",
    family_device_id,
    secure_family_device_id: "",
    credentials_type: "password",
    enroll_misauth: "false",
    generate_session_cookies: "1",
    source: "login",
    generate_machine_id: "1",
    jazoest: "22297",
    meta_inf_fbmeta: "NO_FILE",
    advertiser_id: uuidv4(),
    currently_logged_in_userid: "0",
    locale: "en_US",
    client_country_code: "US",
    fb_api_req_friendly_name: "authenticate",
    fb_api_caller_class: "AuthOperations$PasswordAuthOperation",
    api_key: "256002347743983",
    access_token: "256002347743983|374e60f8b9bb6b8cbb30f78030438895"
  };
  
  const headers = {
    "User-Agent": MESSENGER_USER_AGENT,
    "Accept-Encoding": "gzip, deflate",
    "Content-Type": "application/x-www-form-urlencoded",
    "x-fb-connection-quality": "EXCELLENT",
    "x-fb-sim-hni": "45204",
    "x-fb-net-hni": "45204",
    "x-fb-connection-type": "WIFI",
    "x-tigon-is-retry": "False",
    "x-fb-friendly-name": "authenticate",
    "x-fb-request-analytics-tags": '{"network_tags":{"retry_attempt":"0"},"application_tags":"unknown"}',
    "x-fb-http-engine": "Liger",
    "x-fb-client-ip": "True",
    "x-fb-server-cluster": "True",
    authorization: `OAuth ${base.access_token}`
  };
  
  const form1 = { ...base };
  form1.sig = encodeSig(sortObject(form1));
  
  log.info("autoLogin", "Attempting Graph API login...");
  
  const res1 = await client.request({
    url: "https://b-graph.facebook.com/auth/login",
    method: "post",
    data: qs.stringify(form1),
    headers
  });
  
  // Success - got session cookies
  if (res1.status === 200 && res1.data && res1.data.session_cookies) {
    const appstate = res1.data.session_cookies.map(c => ({
      key: c.name,
      value: c.value,
      domain: c.domain || ".facebook.com",
      path: c.path || "/"
    }));
    
    const cUserCookie = appstate.find(c => c.key === "c_user");
    if (i_user) {
      appstate.push({ key: "i_user", value: i_user, domain: ".facebook.com", path: "/" });
    } else if (cUserCookie) {
      appstate.push({ key: "i_user", value: cUserCookie.value, domain: ".facebook.com", path: "/" });
    }
    
    await setJarCookies(cookieJar, appstate);
    
    log.info("autoLogin", "Login successful!");
    
    return {
      ok: true,
      cookies: appstate,
      jar: cookieJar,
      access_token: res1.data.access_token || null,
      uid: res1.data.uid || cUserCookie?.value || null,
      session_key: res1.data.session_key || null
    };
  }
  
  // Check for 2FA requirement
  const err = res1.data?.error || {};
  if (err.code === 406) {
    log.info("autoLogin", "2FA required, attempting authentication...");
    
    const data = err.error_data || {};
    let code = null;
    
    // Check if provided value is already a 6-digit code
    if (twofactorSecretOrCode && /^\d{6}$/.test(String(twofactorSecretOrCode))) {
      code = String(twofactorSecretOrCode);
    } else if (twofactorSecretOrCode) {
      // Generate TOTP from secret
      code = await genTotp(twofactorSecretOrCode);
    }
    
    if (!code) {
      log.error("autoLogin", "2FA required but no valid code/secret provided");
      return { ok: false, message: "2FA required but no code provided" };
    }
    
    const form2 = {
      ...base,
      credentials_type: "two_factor",
      twofactor_code: code,
      userid: data.uid || username,
      first_factor: data.login_first_factor || "",
      machine_id: data.machine_id || machine_id
    };
    form2.sig = encodeSig(sortObject(form2));
    
    const res2 = await client.request({
      url: "https://b-graph.facebook.com/auth/login",
      method: "post",
      data: qs.stringify(form2),
      headers
    });
    
    if (res2.status === 200 && res2.data && res2.data.session_cookies) {
      const appstate = res2.data.session_cookies.map(c => ({
        key: c.name,
        value: c.value,
        domain: c.domain || ".facebook.com",
        path: c.path || "/"
      }));
      
      const cUserCookie = appstate.find(c => c.key === "c_user");
      if (i_user) {
        appstate.push({ key: "i_user", value: i_user, domain: ".facebook.com", path: "/" });
      } else if (cUserCookie) {
        appstate.push({ key: "i_user", value: cUserCookie.value, domain: ".facebook.com", path: "/" });
      }
      
      await setJarCookies(cookieJar, appstate);
      
      log.info("autoLogin", "2FA login successful!");
      
      return {
        ok: true,
        cookies: appstate,
        jar: cookieJar,
        access_token: res2.data.access_token || null,
        uid: res2.data.uid || cUserCookie?.value || null,
        session_key: res2.data.session_key || null
      };
    }
    
    log.error("autoLogin", "2FA authentication failed");
    return { ok: false, message: "2FA authentication failed" };
  }
  
  log.error("autoLogin", `Login failed: ${err.message || "Unknown error"}`);
  return { ok: false, message: err.message || "Login failed" };
}

/**
 * Load credentials from config file
 * @returns {Object|null} Credentials object or null
 */
function loadCredentials() {
  try {
    const configPath = path.join(process.cwd(), "fca-config.json");
    if (!fs.existsSync(configPath)) return null;
    
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    if (!config.credentials || !config.credentials.email || !config.credentials.password) {
      return null;
    }
    
    return {
      email: config.credentials.email,
      password: config.credentials.password,
      twofactor: config.credentials.twofactor || null
    };
  } catch (e) {
    log.warn("autoLogin", `Failed to load credentials: ${e.message}`);
    return null;
  }
}

/**
 * Check if auto-login is enabled
 * @returns {boolean}
 */
function isAutoLoginEnabled() {
  try {
    const configPath = path.join(process.cwd(), "fca-config.json");
    if (!fs.existsSync(configPath)) return false;
    
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    return config.autoLogin === true;
  } catch (_) {
    return false;
  }
}

/**
 * Create performAutoLogin function for ctx
 * @param {Object} ctx - Context object
 * @param {Object} jar - Cookie jar
 * @param {Object} globalOptions - Global options
 * @returns {Function} performAutoLogin function
 */
function createPerformAutoLogin(ctx, jar, globalOptions) {
  return async function performAutoLogin() {
    // Prevent concurrent auto-login attempts
    if (ctx._autoLoginInProgress) {
      log.warn("autoLogin", "Auto-login already in progress, skipping...");
      return false;
    }
    
    if (!isAutoLoginEnabled()) {
      log.warn("autoLogin", "Auto-login is disabled in config");
      return false;
    }
    
    const creds = loadCredentials();
    if (!creds) {
      log.error("autoLogin", "No credentials configured for auto-login");
      return false;
    }
    
    ctx._autoLoginInProgress = true;
    log.info("autoLogin", "Session expired, attempting auto-login recovery...");
    
    try {
      const result = await loginViaGraph(creds.email, creds.password, creds.twofactor, ctx.userID);
      
      if (!result.ok) {
        log.error("autoLogin", `Auto-login failed: ${result.message}`);
        ctx._autoLoginInProgress = false;
        return false;
      }
      
      // Update cookies in jar
      for (const cookie of result.cookies) {
        const cookieStr = `${cookie.key}=${cookie.value}; Domain=${cookie.domain}; Path=${cookie.path};`;
        try {
          if (typeof jar.setCookieSync === "function") {
            jar.setCookieSync(cookieStr, "https://www.facebook.com");
          } else {
            await jar.setCookie(cookieStr, "https://www.facebook.com");
          }
        } catch (_) { }
      }
      
      // Save updated appstate
      try {
        const appstatePath = globalOptions.appstatePath || path.join(process.cwd(), "appstate.json");
        fs.writeFileSync(appstatePath, JSON.stringify(result.cookies, null, 2));
        log.info("autoLogin", "Saved new appstate to file");
      } catch (e) {
        log.warn("autoLogin", `Failed to save appstate: ${e.message}`);
      }
      
      log.info("autoLogin", "Auto-login recovery successful!");
      ctx._autoLoginInProgress = false;
      return true;
      
    } catch (e) {
      log.error("autoLogin", `Auto-login error: ${e.message}`);
      ctx._autoLoginInProgress = false;
      return false;
    }
  };
}

module.exports = {
  loginViaGraph,
  genTotp,
  setJarCookies,
  loadCredentials,
  isAutoLoginEnabled,
  createPerformAutoLogin
};
