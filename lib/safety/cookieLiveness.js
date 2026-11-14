"use strict";

/**
 * Cookie liveness probe — validates a Facebook cookie set WITHOUT creating
 * a session and without writing anything to disk.
 *
 * Parity with neokex-fca's `login.utils.checkLiveCookie`, implemented
 * locally: the cookies are never uploaded anywhere (neokex runs this
 * against its own server; we check Facebook directly from this machine).
 *
 * Accepted input shapes:
 *   - exported cookie array [{key,value} | {name,value}, ...]
 *   - raw cookie string "c_user=...; xs=...;"
 *   - cookies.txt export (Netscape format)
 *   - a jar-like object with getCookies(url) (tough-cookie)
 *
 * @param {Array|String|Object} input - any of the shapes above
 * @param {Object} [options] - { userAgent, timeoutMs }
 * @returns {Promise<{live:boolean, accountID:string|null, reason:string, checkedAt:string}>}
 */

const https = require("https");

function pair(entry) {
  if (!entry || typeof entry !== "object") return null;
  const key = entry.key || entry.name;
  const value = entry.value;
  if (!key || value === undefined || value === null) return null;
  return [String(key).trim(), String(value)];
}

function pairsToHeader(pairs) {
  return pairs
    .filter(Boolean)
    .map(([k, v]) => k + "=" + v)
    .join("; ");
}

function fromArray(arr) {
  return arr.map(pair).filter(Boolean);
}

function fromCookieString(str) {
  const out = [];
  str.split(";").forEach(part => {
    const sep = part.indexOf("=");
    if (sep === -1) return;
    const k = part.slice(0, sep).trim();
    const v = part.slice(sep + 1).trim();
    if (k) out.push([k, v]);
  });
  return out;
}

function fromNetscape(str) {
  const out = [];
  str.split(/\r?\n/).forEach(line => {
    if (!line || line.trim().startsWith("#")) return;
    const cols = line.split("\t");
    if (cols.length < 7) return;
    const name = cols[5].trim();
    const value = cols.slice(6).join("\t").trim();
    if (name) out.push([name, value]);
  });
  return out;
}

function fromJar(jar) {
  const cookies = jar.getCookies("https://www.facebook.com");
  return (cookies || []).map(pair).filter(Boolean);
}

/**
 * Normalize every accepted input shape into a flat [ [name, value], ... ] list.
 */
function normalizeCookieInput(input) {
  if (Array.isArray(input)) return fromArray(input);
  if (typeof input === "string") {
    // cookies.txt (Netscape) exports start with a comment header
    if (/^\s*#.*Netscape.*Cookie/i.test(input) || /\t/.test(input.split(/\r?\n/)[0] || "")) {
      const fromFile = fromNetscape(input);
      if (fromFile.length) return fromFile;
    }
    return fromCookieString(input);
  }
  if (input && typeof input === "object") {
    if (typeof input.getCookies === "function") return fromJar(input);
    if (input.jar && typeof input.jar.getCookies === "function") return fromJar(input.jar);
    if (Array.isArray(input.cookies)) return fromArray(input.cookies);
  }
  return null;
}

/**
 * Check whether the cookie set still authenticates with Facebook.
 * Never creates a session and never touches the filesystem.
 */
function checkLiveCookie(input, options) {
  options = options || {};
  const pairs = normalizeCookieInput(input);
  const checkedAt = new Date().toISOString();
  if (!pairs || pairs.length === 0) {
    return Promise.resolve({ live: false, accountID: null, reason: "no cookies could be parsed from the input", checkedAt });
  }

  const map = new Map(pairs);
  const accountID = map.get("c_user") || map.get("i_user") || null;
  if (!accountID || !map.get("xs")) {
    return Promise.resolve({ live: false, accountID, reason: "c_user and xs cookies are required for a liveness check", checkedAt });
  }

  const header = pairsToHeader(pairs);
  const ua = options.userAgent
    || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
  const timeoutMs = Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : 10000;

  return new Promise(resolve => {
    let settled = false;
    const finish = result => {
      if (settled) return;
      settled = true;
      resolve({ ...result, accountID, checkedAt });
    };

    const req = https.get(
      {
        host: "mbasic.facebook.com",
        path: "/settings",
        method: "GET",
        timeout: timeoutMs,
        headers: {
          cookie: header,
          "user-agent": ua,
          "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "accept-language": "en-US,en;q=0.9",
          "upgrade-insecure-requests": "1"
        }
      },
      res => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", d => { body += d; });
        res.on("end", () => {
          const s = body || "";
          // Evidence-based: the settings page of a live session carries the
          // account's own id and its management markup; a dead one is
          // redirected to a login page with a real login form.
          const proof = s.includes(String(accountID));
          const loginForm = /<form[^>]+action="[^"]*login[^"]*"/i.test(s) && s.includes('name="password"');
          const settingsMarkers = s.includes("/privacy/xcs/action/logging/")
            || s.includes("/notifications.php?")
            || s.includes("href=\"/settings");

          if (res.statusCode === 200 && proof && !loginForm) return finish({ live: true, reason: "settings page carries the account id" });
          if (settingsMarkers && !loginForm) return finish({ live: true, reason: "settings markers present" });
          if (loginForm) return finish({ live: false, reason: "Facebook served a login form (session dead)", checkedAt });
          finish({ live: false, reason: "no logged-in evidence in the settings response (HTTP " + res.statusCode + ")", checkedAt });
        });
      }
    );

    req.on("timeout", () => {
      req.destroy();
      finish({ live: false, reason: "liveness check timed out", checkedAt });
    });
    req.on("error", err => {
      finish({ live: false, reason: "network error: " + (err && err.message), checkedAt });
    });
  });
}

module.exports = { checkLiveCookie, normalizeCookieInput };
