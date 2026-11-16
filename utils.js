"use strict";
var url = require("url");
const log = require("npmlog");
const stream = require("stream");
const querystring = require("querystring");
const got = require("got");
const { CookieJar } = require("tough-cookie");
const FormData = require("form-data");
const { HttpProxyAgent } = require("http-proxy-agent");
const { HttpsProxyAgent } = require("https-proxy-agent");
const { SocksProxyAgent } = require("socks-proxy-agent");
const { randomUserAgent } = require("./user-agents");

let globalProxy;

class CustomError extends Error {
    constructor(obj) {
        if (typeof obj === 'string')
            obj = { message: obj };
        if (typeof obj !== 'object' || obj === null)
            throw new TypeError('Object required');
        obj.message ? super(obj.message) : super();
        Object.assign(this, obj);
    }
}

function tryPromise(tryFunc) {
    return new Promise((resolve, reject) => {
        try {
            resolve(tryFunc());
        } catch (error) {
            reject(error);
        }
    });
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function setProxy(url) {
    globalProxy = url;
}

function getAgent(url) {
    if (!globalProxy) return undefined;
    if (globalProxy.startsWith('socks')) {
        const agent = new SocksProxyAgent(globalProxy);
        return {
            http: agent,
            https: agent
        };
    }
    return {
        http: new HttpProxyAgent(globalProxy),
        https: new HttpsProxyAgent(globalProxy)
    };
}

// tough-cookie requires cookie.expires to be a Date or the string
// "Infinity". Anything else (a UTC/ISO string, a number, null) makes
// every later getCookies/getCookieString call throw
// "TypeError: this.expires.getTime is not a function" — the jar is
// poisoned for all reads, not just the offending cookie. Cookies built
// from appstate JSON always carry expires as a string, so every entry
// point that accepts a cookie object must normalize it first.
function normalizeCookieExpiry(value) {
    if (value === undefined || value === null || value === "") return "Infinity";
    if (value === "Infinity") return "Infinity";
    if (value instanceof Date) return isNaN(value.getTime()) ? "Infinity" : value;
    if (typeof value === "number") {
        const ms = value > 1e12 ? value : value * 1000; // epoch secs or millis
        const d = new Date(ms);
        return isNaN(d.getTime()) ? "Infinity" : d;
    }
    if (typeof value === "string") {
        const d = new Date(value);
        return isNaN(d.getTime()) ? "Infinity" : d;
    }
    return "Infinity";
}

function getJar() {
    const jar = new CookieJar();
    const originalSetCookie = jar.setCookie;

    jar.setCookie = function (cookieOrStr, uri, options, callback) {
        if (typeof options === 'function') {
            callback = options;
            options = {};
        }
        if (cookieOrStr && typeof cookieOrStr === 'object') {
            // Objects bypass tough-cookie's Set-Cookie parsing, so an
            // invalid expires field would be stored as-is and poison
            // the jar. Normalize before it enters the store.
            cookieOrStr.expires = normalizeCookieExpiry(cookieOrStr.expires);
            // tough-cookie's own parser strips the leading dot from a
            // Domain attribute; cookies constructed directly keep it and
            // then never match any URL in v5. Mirror the parser here.
            if (typeof cookieOrStr.domain === 'string' && cookieOrStr.domain.charAt(0) === '.') {
                cookieOrStr.domain = cookieOrStr.domain.slice(1);
                cookieOrStr.hostOnly = false;
            }
        }
        if (callback) {
            return originalSetCookie.call(jar, cookieOrStr, uri, options, callback);
        }
        return jar.setCookieSync(cookieOrStr, uri, options || {});
    };

    const originalGetCookies = jar.getCookies;
    jar.getCookies = function (uri, options, callback) {
        if (typeof options === 'function') {
            callback = options;
            options = {};
        }
        if (callback) {
            return originalGetCookies.call(jar, uri, options, callback);
        }
        return jar.getCookiesSync(uri, options || {});
    }

    return jar;
}

// Sanitize header value to remove invalid characters
function sanitizeHeaderValue(value) {
    if (value === null || value === undefined) return "";
    let str = String(value);
    if (str.trim().startsWith("[") && str.trim().endsWith("]")) {
        try {
            const parsed = JSON.parse(str);
            if (Array.isArray(parsed)) return "";
        } catch { }
    }
    return str.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F\r\n\[\]]/g, "").trim();
}

function sanitizeHeaderName(name) {
    if (!name || typeof name !== "string") return "";
    return name.replace(/[^\x21-\x7E]/g, "").trim();
}

// Build stable Client Hints for a fixed User-Agent string
// (used by fingerprint lock + fixed-UA mode)
function hintsForUA(userAgent) {
    const m = String(userAgent).match(/Chrome\/(\d+)/);
    const major = m ? m[1] : "141";
    const isMac = /Macintosh/.test(String(userAgent));
    const isLinux = /Linux/.test(String(userAgent));
    const brands = [
        `"Not(A:Brand";v="99"`,
        `"Chromium";v="${major}"`,
        `"Google Chrome";v="${major}"`
    ];
    const platform = isMac ? "macOS" : isLinux ? "Linux" : "Windows";
    return {
        userAgent: String(userAgent),
        secChUa: brands.join(', '),
        secChUaFullVersionList: brands.map((b) => b.replace(/"$/, `.0.0.0"`)).join(', '),
        secChUaPlatform: `"${platform}"`,
        // Chrome on Linux reports an empty platform version; desktop Win/mac report the OS build.
        secChUaPlatformVersion: isLinux ? '""' : '"19.0.0"'
    };
}

function getHeaders(url, options, ctx, customHeader) {
    // FINGERPRINT LOCK (best practice):
    // A real browser NEVER changes its User-Agent per request. Old code called
    // randomUserAgent() on EVERY request -> rotating fingerprint = bot signal.
    // Now: one UA + Client Hints locked per session (ctx._fpLocked).
    // Opt-outs: fingerprintLock:false (rotate like before),
    //           or randomUserAgent:false with a fixed userAgent string (fixed UA).
    let fp = null;
    const gOpts = (ctx && ctx.globalOptions) || {};
    if (ctx && ctx._fpLocked) {
        fp = ctx._fpLocked;
    } else {
        // Fixed UA wins when: explicitly opted in (randomUserAgent:false),
        // a per-call userAgent was given, OR a session-wide userAgent exists
        // (Goat-Bot / index.js always resolve one). Rotation only happens when
        // randomUserAgent is explicitly true.
        const fixedUA = (options && options.userAgent) || gOpts.userAgent;
        const wantFixed = Boolean(fixedUA) && gOpts.randomUserAgent !== true;
        if (wantFixed && fixedUA) {
            fp = hintsForUA(fixedUA);
        } else {
            fp = randomUserAgent();
        }
        if (ctx && gOpts.fingerprintLock !== false) {
            ctx._fpLocked = fp;
        }
    }
    const {
        userAgent,
        secChUa,
        secChUaFullVersionList,
        secChUaPlatform,
        secChUaPlatformVersion
    } = fp;

    const host = new URL(url).hostname;
    const referer = `https://${host}/`;

    // 2. Build Base Headers
    const headers = {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'max-age=0',
        'Connection': 'keep-alive',
        'Dpr': '1',
        'Host': host,
        'Origin': `https://${host}`,
        'Referer': referer,
        'Sec-Ch-Prefers-Color-Scheme': 'light',
        'Sec-Ch-Ua': secChUa,
        'Sec-Ch-Ua-Full-Version-List': secChUaFullVersionList,
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Model': '""',
        'Sec-Ch-Ua-Platform': secChUaPlatform,
        'Sec-Ch-Ua-Platform-Version': secChUaPlatformVersion,
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        'User-Agent': userAgent,
        'Viewport-Width': '1920'
    };

    // 3. Inject Contextual Headers (LSD, Region, Spin)
    if (ctx) {
        if (ctx.fb_dtsg) {
            headers['X-Fb-Lsd'] = ctx.lsd;
        }
        if (ctx.region) {
            headers['X-MSGR-Region'] = ctx.region;
        }
        if (ctx.master) {
            const { __spin_r, __spin_b, __spin_t } = ctx.master;
            if (__spin_r) headers['X-Fb-Spin-R'] = String(__spin_r);
            if (__spin_b) headers['X-Fb-Spin-B'] = String(__spin_b);
            if (__spin_t) headers['X-Fb-Spin-T'] = String(__spin_t);
        }
    }
    
    // 4. Merge Custom Headers
    if (customHeader) {
        Object.assign(headers, customHeader);
        if (customHeader.noRef) {
            delete headers.Referer;
        }
    }

    // 5. Final Sanitization Pass
    const sanitizedHeaders = {};
    for (const [key, value] of Object.entries(headers)) {
        const sanitizedKey = sanitizeHeaderName(key);
        const sanitizedValue = sanitizeHeaderValue(value);
        if (sanitizedKey && sanitizedValue !== "") {
            sanitizedHeaders[sanitizedKey] = sanitizedValue;
        }
    }

    return sanitizedHeaders;
}

function isReadableStream(obj) {
    return (
        obj instanceof stream.Stream &&
        (getType(obj._read) === "Function" ||
            getType(obj._read) === "AsyncFunction") &&
        getType(obj._readableState) === "Object"
    );
}

function cleanObject(obj) {
    if (getType(obj) !== "Object") return obj;
    const newObj = {};
    for (const key in obj) {
        if (obj[key] !== null && obj[key] !== undefined) {
            newObj[key] = obj[key];
        }
    }
    return newObj;
}

async function get(url, jar, qs, options, ctx) {
    if (getType(qs) === "Object")
        for (var prop in qs)
            if (qs.hasOwnProperty(prop) && getType(qs[prop]) === "Object") qs[prop] = JSON.stringify(qs[prop]);
    var op = {
        headers: getHeaders(url, options, ctx),
        timeout: { request: 60000 },
        method: "GET",
        cookieJar: jar,
        throwHttpErrors: false,
        decompress: true,
        agent: getAgent(url)
    };
    if (qs) op.searchParams = cleanObject(qs);

    return got(url, op).then(function (res) {
        saveCookies(jar, ctx)(res);
        return res;
    });
}

async function get2(url, jar, headers, options, ctx) {
    var op = {
        headers: getHeaders(url, options, ctx, headers),
        timeout: { request: 60000 },
        method: "GET",
        cookieJar: jar,
        throwHttpErrors: false,
        decompress: true,
        agent: getAgent(url)
    };

    return got(url, op).then(function (res) {
        saveCookies(jar, ctx)(res);
        return res;
    });
}

async function post(url, jar, form, options, ctx, customHeader) {
    var headers = getHeaders(url, options, ctx, customHeader);
    var op = {
        headers: headers,
        timeout: { request: 60000 },
        method: "POST",
        cookieJar: jar,
        throwHttpErrors: false,
        decompress: true,
        agent: getAgent(url)
    };

    // Manual body construction (request-compatible behavior)
    if (form) {
        // 1. Clean null/undefined
        form = cleanObject(form);

        // 2. Check Content-Type
        let contentType = headers['Content-Type'] || 'application/x-www-form-urlencoded';

        if (contentType.includes('json')) {
            op.body = JSON.stringify(form);
        } else {
            // 3. Transform to URLSearchParams (application/x-www-form-urlencoded)
            // We use URLSearchParams to ensure correct encoding
            const params = new URLSearchParams();
            for (const key in form) {
                if (form.hasOwnProperty(key)) {
                    let value = form[key];
                    // Stringify nested objects (but not Arrays)
                    if (getType(value) === "Object") {
                        value = JSON.stringify(value);
                    }
                    params.append(key, value);
                }
            }
            op.body = params.toString();
        }
        // CRITICAL: Explicitly set Content-Type because 'got' won't do it for manual 'body'
        headers['Content-Type'] = contentType;
    }

    return got(url, op).then(function (res) {
        saveCookies(jar, ctx)(res);
        return res;
    });
}

function isFormData(obj) {
    return obj instanceof FormData;
}

// A form value may be wrapped in { __formDataOptions: true, value, options }
// so per-field options (filename, knownLength, contentType) survive.
function appendFormField(body, key, value) {
    if (value && value.__formDataOptions) {
        body.append(key, value.value, value.options);
    } else {
        body.append(key, value);
    }
}

function isReplayableFormValue(value) {
    return (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean" ||
        Buffer.isBuffer(value) ||
        (value && value.__formDataOptions && isReplayableFormValue(value.value))
    );
}

function isRetryableTransportError(err) {
    const code = String((err && err.code) || "");
    const message = String((err && err.message) || "");
    return (
        code === "ERR_GOT_REQUEST_ERROR" ||
        code === "ECONNRESET" ||
        code === "EPIPE" ||
        code === "ETIMEDOUT" ||
        code === "EAI_AGAIN" ||
        /stream|socket hang up|aborted/i.test(message)
    );
}

async function postFormData(url, jar, form, qs, options, ctx) {
    // `form` may be a plain object (legacy) or a factory that returns a fresh
    // plain object / FormData. Multipart bodies are one-shot: retrying a
    // consumed body uploads an empty request and Facebook replies 400. A
    // factory lets every attempt build a complete body again.
    const formFactory = typeof form === "function" ? form : null;
    const staticForm = formFactory ? null : (cleanObject(form) || {});
    const replayable = formFactory
        ? true
        : (function () {
              if (isFormData(staticForm)) return false;
              return Object.keys(staticForm).every(function (key) {
                  return isReplayableFormValue(staticForm[key]);
              });
          })();
    // Used by parseAndCheckLogin's 5xx retry to rebuild a complete body.
    const rebuildForm = formFactory || (replayable ? function () { return staticForm; } : null);

    const buildBody = function () {
        const source = formFactory ? formFactory() : staticForm;
        const body = isFormData(source) ? source : new FormData();
        if (!isFormData(source)) {
            const fields = cleanObject(source);
            for (const key in fields) appendFormField(body, key, fields[key]);
        }
        if (rebuildForm) {
            try { body._nexusFormFactory = rebuildForm; } catch (_) { }
        }
        return body;
    };

    const send = function (timeout) {
        const body = buildBody();
        const headers = getHeaders(url, options, ctx);
        Object.assign(headers, body.getHeaders());

        const op = {
            headers: headers,
            timeout: timeout,
            method: "POST",
            body: body,
            cookieJar: jar,
            throwHttpErrors: false,
            decompress: true,
            agent: getAgent(url),
            // Never let got replay a consumed multipart body. Our retry
            // layers rebuild it from the factory instead.
            retry: { limit: 0 }
        };
        if (qs) op.searchParams = cleanObject(qs);

        return got(url, op).then(function (res) {
            saveCookies(jar, ctx)(res);
            return res;
        });
    };

    try {
        return await send({ request: 120000, response: 60000 });
    } catch (err) {
        if (replayable && isRetryableTransportError(err)) {
            log.warn("postFormData", "Retrying upload with extended timeout and a fresh body...");
            return send({ request: 180000, response: 120000 });
        }
        throw err;
    }
}

function padZeros(val, len) {
    val = String(val);
    len = len || 2;
    while (val.length < len) val = "0" + val;
    return val;
}

function generateThreadingID(clientID) {
    var k = Date.now();
    var l = Math.floor(Math.random() * 4294967295);
    var m = clientID;
    return "<" + k + ":" + l + "-" + m + "@mail.projektitan.com>";
}

function binaryToDecimal(data) {
    var ret = "";
    while (data !== "0") {
        var end = 0;
        var fullName = "";
        var i = 0;
        for (; i < data.length; i++) {
            end = 2 * end + parseInt(data[i], 10);
            if (end >= 10) {
                fullName += "1";
                end -= 10;
            } else fullName += "0";
        }
        ret = end.toString() + ret;
        data = fullName.slice(fullName.indexOf("1"));
    }
    return ret;
}

function generateOfflineThreadingID() {
    var ret = Date.now();
    var value = Math.floor(Math.random() * 4294967295);
    var str = ("0000000000000000000000" + value.toString(2)).slice(-22);
    var msgs = ret.toString(2) + str;
    return binaryToDecimal(msgs);
}

var h;
var i = {};
var j = {
    _: "%",
    A: "%2",
    B: "000",
    C: "%7d",
    D: "%7b%22",
    E: "%2c%22",
    F: "%22%3a",
    G: "%2c%22ut%22%3a1",
    H: "%2c%22bls%22%3a",
    I: "%2c%22n%22%3a%22%",
    J: "%22%3a%7b%22i%22%3a0%7d",
    K: "%2c%22pt%22%3a0%2c%22vis%22%3a",
    L: "%2c%22ch%22%3a%7b%22h%22%3a%22",
    M: "%7b%22v%22%3a2%2c%22time%22%3a1",
    N: ".channel%22%2c%22sub%22%3a%5b",
    O: "%2c%22sb%22%3a1%2c%22t%22%3a%5b",
    P: "%2c%22ud%22%3a100%2c%22lc%22%3a0",
    Q: "%5d%2c%22f%22%3anull%2c%22uct%22%3a",
    R: ".channel%22%2c%22sub%22%3a%5b1%5d",
    S: "%22%2c%22m%22%3a0%7d%2c%7b%22i%22%3a",
    T: "%2c%22blc%22%3a1%2c%22snd%22%3a1%2c%22ct%22%3a",
    U: "%2c%22blc%22%3a0%2c%22snd%22%3a1%2c%22ct%22%3a",
    V: "%2c%22blc%22%3a0%2c%22snd%22%3a0%2c%22ct%22%3a",
    W: "%2c%22s%22%3a0%2c%22blo%22%3a0%7d%2c%22bl%22%3a%7b%22ac%22%3a",
    X: "%2c%22ri%22%3a0%7d%2c%22state%22%3a%7b%22p%22%3a0%2c%22ut%22%3a1",
    Y: "%2c%22pt%22%3a0%2c%22vis%22%3a1%2c%22bls%22%3a0%2c%22blc%22%3a0%2c%22snd%22%3a1%2c%22ct%22%3a",
    Z: "%2c%22sb%22%3a1%2c%22t%22%3a%5b%5d%2c%22f%22%3anull%2c%22uct%22%3a0%2c%22s%22%3a0%2c%22blo%22%3a0%7d%2c%22bl%22%3a%7b%22ac%22%3a"
};
(function () {
    var l = [];
    for (var m in j) {
        i[j[m]] = m;
        l.push(j[m]);
    }
    l.reverse();
    h = new RegExp(l.join("|"), "g");
})();

function presenceEncode(str) {
    return encodeURIComponent(str)
        .replace(/([_A-Z])|%../g, function (m, n) {
            return n ? "%" + n.charCodeAt(0).toString(16) : m;
        })
        .toLowerCase()
        .replace(h, function (m) {
            return i[m];
        });
}

function presenceDecode(str) {
    return decodeURIComponent(
        str.replace(/[_A-Z]/g, function (/** @type {string | number} */m) {
            return j[m];
        })
    );
}

function generatePresence(userID) {
    var time = Date.now();
    return (
        "E" +
        presenceEncode(
            JSON.stringify({
                v: 3,
                time: parseInt(time / 1000, 10),
                user: userID,
                state: {
                    ut: 0,
                    t2: [],
                    lm2: null,
                    uct2: time,
                    tr: null,
                    tw: Math.floor(Math.random() * 4294967295) + 1,
                    at: time
                },
                ch: {
                    ["p_" + userID]: 0
                }
            })
        )
    );
}

/**
 * Generate a unique MQTT client ID for each connection
 * Fresh clientID on each reconnect prevents Facebook from
 * detecting "stale" sessions and force-disconnecting
 * @returns {string} Unique client identifier
 */
function generateClientID() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    const counter = (global.__NEXUS_CLIENT_COUNTER__ = (global.__NEXUS_CLIENT_COUNTER__ || 0) + 1);
    return `mqttwsclient_${timestamp}_${random}_${counter}`;
}

function getGUID() {
    // 1. Check Environment Variable (Best for Render/Heroku/Replit)
    if (process.env.NEXUS_DEVICE_ID) {
        return process.env.NEXUS_DEVICE_ID;
    }

    var devicePath = require("path").join(process.cwd(), "nexus_device.json");
    var fs = require("fs");

    // 2. Check File System (Local Persistence)
    try {
        if (fs.existsSync(devicePath)) {
            var data = JSON.parse(fs.readFileSync(devicePath, "utf8"));
            if (data && data.guid) return data.guid;
        }
    } catch (e) { }

    // 3. Generate New Device ID
    var sectionLength = Date.now();
    var id = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
        var r = Math.floor((sectionLength + Math.random() * 16) % 16);
        sectionLength = Math.floor(sectionLength / 16);
        var _guid = (c == "x" ? r : (r & 7) | 8).toString(16);
        return _guid;
    });

    // 4. Save & Log
    try {
        fs.writeFileSync(devicePath, JSON.stringify({ guid: id, generatedAt: Date.now() }, null, 2));
    } catch (e) { }

    // Warn user to verify persistence
    var log = require("npmlog");
    log.warn("NEXUS-FCA", "New Device ID generated: " + id);
    log.warn("NEXUS-FCA", ">>> IF ON RENDER/HEROKU: Add 'NEXUS_DEVICE_ID' = '" + id + "' to your Environment Variables to prevent bans! <<<");

    return id;
}

function _formatAttachment(attachment1, attachment2) {
    attachment2 = attachment2 || { id: "", image_data: {} };
    attachment1 = attachment1.mercury ? attachment1.mercury : attachment1;
    var blob = attachment1.blob_attachment;
    var type =
        blob && blob.__typename ? blob.__typename : attachment1.attach_type;
    if (!type && attachment1.sticker_attachment) {
        type = "StickerAttachment";
        blob = attachment1.sticker_attachment;
    } else if (!type && attachment1.extensible_attachment) {
        if (
            attachment1.extensible_attachment.story_attachment &&
            attachment1.extensible_attachment.story_attachment.target &&
            attachment1.extensible_attachment.story_attachment.target.__typename &&
            attachment1.extensible_attachment.story_attachment.target.__typename === "MessageLocation"
        ) type = "MessageLocation";
        else type = "ExtensibleAttachment";

        blob = attachment1.extensible_attachment;
    }
    switch (type) {
        case "sticker":
            return {
                type: "sticker",
                ID: attachment1.metadata.stickerID.toString(),
                url: attachment1.url,

                packID: attachment1.metadata.packID.toString(),
                spriteUrl: attachment1.metadata.spriteURI,
                spriteUrl2x: attachment1.metadata.spriteURI2x,
                width: attachment1.metadata.width,
                height: attachment1.metadata.height,

                caption: attachment2.caption,
                description: attachment2.description,

                frameCount: attachment1.metadata.frameCount,
                frameRate: attachment1.metadata.frameRate,
                framesPerRow: attachment1.metadata.framesPerRow,
                framesPerCol: attachment1.metadata.framesPerCol,

                stickerID: attachment1.metadata.stickerID.toString(), // @Legacy
                spriteURI: attachment1.metadata.spriteURI, // @Legacy
                spriteURI2x: attachment1.metadata.spriteURI2x // @Legacy
            };
        case "file":
            return {
                type: "file",
                filename: attachment1.name,
                ID: attachment2.id.toString(),
                url: attachment1.url,

                isMalicious: attachment2.is_malicious,
                contentType: attachment2.mime_type,

                name: attachment1.name, // @Legacy
                mimeType: attachment2.mime_type, // @Legacy
                fileSize: attachment2.file_size // @Legacy
            };
        case "photo":
            return {
                type: "photo",
                ID: attachment1.metadata.fbid.toString(),
                filename: attachment1.fileName,
                thumbnailUrl: attachment1.thumbnail_url,

                previewUrl: attachment1.preview_url,
                previewWidth: attachment1.preview_width,
                previewHeight: attachment1.preview_height,

                largePreviewUrl: attachment1.large_preview_url,
                largePreviewWidth: attachment1.large_preview_width,
                largePreviewHeight: attachment1.large_preview_height,

                url: attachment1.metadata.url, // @Legacy
                width: attachment1.metadata.dimensions.split(",")[0], // @Legacy
                height: attachment1.metadata.dimensions.split(",")[1], // @Legacy
                name: attachment1.fileName // @Legacy
            };
        case "animated_image":
            return {
                type: "animated_image",
                ID: attachment2.id.toString(),
                filename: attachment2.filename,

                previewUrl: attachment1.preview_url,
                previewWidth: attachment1.preview_width,
                previewHeight: attachment1.preview_height,

                url: attachment2.image_data.url,
                width: attachment2.image_data.width,
                height: attachment2.image_data.height,

                name: attachment1.name, // @Legacy
                facebookUrl: attachment1.url, // @Legacy
                thumbnailUrl: attachment1.thumbnail_url, // @Legacy
                mimeType: attachment2.mime_type, // @Legacy
                rawGifImage: attachment2.image_data.raw_gif_image, // @Legacy
                rawWebpImage: attachment2.image_data.raw_webp_image, // @Legacy
                animatedGifUrl: attachment2.image_data.animated_gif_url, // @Legacy
                animatedGifPreviewUrl: attachment2.image_data.animated_gif_preview_url, // @Legacy
                animatedWebpUrl: attachment2.image_data.animated_webp_url, // @Legacy
                animatedWebpPreviewUrl: attachment2.image_data.animated_webp_preview_url // @Legacy
            };
        case "share":
            return {
                type: "share",
                ID: attachment1.share.share_id.toString(),
                url: attachment2.href,

                title: attachment1.share.title,
                description: attachment1.share.description,
                source: attachment1.share.source,

                image: attachment1.share.media.image,
                width: attachment1.share.media.image_size.width,
                height: attachment1.share.media.image_size.height,
                playable: attachment1.share.media.playable,
                duration: attachment1.share.media.duration,

                subattachments: attachment1.share.subattachments,
                properties: {},

                animatedImageSize: attachment1.share.media.animated_image_size, // @Legacy
                facebookUrl: attachment1.share.uri, // @Legacy
                target: attachment1.share.target, // @Legacy
                styleList: attachment1.share.style_list // @Legacy
            };
        case "video":
            return {
                type: "video",
                ID: attachment1.metadata.fbid.toString(),
                filename: attachment1.name,

                previewUrl: attachment1.preview_url,
                previewWidth: attachment1.preview_width,
                previewHeight: attachment1.preview_height,

                url: attachment1.url,
                width: attachment1.metadata.dimensions.width,
                height: attachment1.metadata.dimensions.height,

                duration: attachment1.metadata.duration,
                videoType: "unknown",

                thumbnailUrl: attachment1.thumbnail_url // @Legacy
            };
        case "error":
            return {
                type: "error",
                attachment1: attachment1,
                attachment2: attachment2
            };
        case "MessageImage":
            return {
                type: "photo",
                ID: blob.legacy_attachment_id,
                filename: blob.filename,
                thumbnailUrl: blob.thumbnail.uri,

                previewUrl: blob.preview.uri,
                previewWidth: blob.preview.width,
                previewHeight: blob.preview.height,

                largePreviewUrl: blob.large_preview.uri,
                largePreviewWidth: blob.large_preview.width,
                largePreviewHeight: blob.large_preview.height,

                url: blob.large_preview.uri, // @Legacy
                width: blob.original_dimensions.x, // @Legacy
                height: blob.original_dimensions.y, // @Legacy
                name: blob.filename // @Legacy
            };
        case "MessageAnimatedImage":
            return {
                type: "animated_image",
                ID: blob.legacy_attachment_id,
                filename: blob.filename,

                previewUrl: blob.preview_image.uri,
                previewWidth: blob.preview_image.width,
                previewHeight: blob.preview_image.height,

                url: blob.animated_image.uri,
                width: blob.animated_image.width,
                height: blob.animated_image.height,

                thumbnailUrl: blob.preview_image.uri, // @Legacy
                name: blob.filename, // @Legacy
                facebookUrl: blob.animated_image.uri, // @Legacy
                rawGifImage: blob.animated_image.uri, // @Legacy
                animatedGifUrl: blob.animated_image.uri, // @Legacy
                animatedGifPreviewUrl: blob.preview_image.uri, // @Legacy
                animatedWebpUrl: blob.animated_image.uri, // @Legacy
                animatedWebpPreviewUrl: blob.preview_image.uri // @Legacy
            };
        case "MessageVideo":
            return {
                type: "video",
                filename: blob.filename,
                ID: blob.legacy_attachment_id,

                previewUrl: blob.large_image.uri,
                previewWidth: blob.large_image.width,
                previewHeight: blob.large_image.height,

                url: blob.playable_url,
                width: blob.original_dimensions.x,
                height: blob.original_dimensions.y,

                duration: blob.playable_duration_in_ms,
                videoType: blob.video_type.toLowerCase(),

                thumbnailUrl: blob.large_image.uri // @Legacy
            };
        case "MessageAudio":
            return {
                type: "audio",
                filename: blob.filename,
                ID: blob.url_shimhash,

                audioType: blob.audio_type,
                duration: blob.playable_duration_in_ms,
                url: blob.playable_url,

                isVoiceMail: blob.is_voicemail
            };
        case "StickerAttachment":
            return {
                type: "sticker",
                ID: blob.id,
                url: blob.url,

                packID: blob.pack ? blob.pack.id : null,
                spriteUrl: blob.sprite_image,
                spriteUrl2x: blob.sprite_image_2x,
                width: blob.width,
                height: blob.height,

                caption: blob.label,
                description: blob.label,

                frameCount: blob.frame_count,
                frameRate: blob.frame_rate,
                framesPerRow: blob.frames_per_row,
                framesPerCol: blob.frames_per_column,

                stickerID: blob.id, // @Legacy
                spriteURI: blob.sprite_image, // @Legacy
                spriteURI2x: blob.sprite_image_2x // @Legacy
            };
        case "MessageLocation":
            var urlAttach = blob.story_attachment.url;
            var mediaAttach = blob.story_attachment.media;

            var u = querystring.parse(url.parse(urlAttach).query).u;
            var where1 = querystring.parse(url.parse(u).query).where1;
            var address = where1.split(", ");

            var latitude;
            var longitude;

            try {
                latitude = Number.parseFloat(address[0]);
                longitude = Number.parseFloat(address[1]);
            } catch (err) {
                /* empty */

            }

            var imageUrl;
            var width;
            var height;

            if (mediaAttach && mediaAttach.image) {
                imageUrl = mediaAttach.image.uri;
                width = mediaAttach.image.width;
                height = mediaAttach.image.height;
            }

            return {
                type: "location",
                ID: blob.legacy_attachment_id,
                latitude: latitude,
                longitude: longitude,
                image: imageUrl,
                width: width,
                height: height,
                url: u || urlAttach,
                address: where1,

                facebookUrl: blob.story_attachment.url, // @Legacy
                target: blob.story_attachment.target, // @Legacy
                styleList: blob.story_attachment.style_list // @Legacy
            };
        case "ExtensibleAttachment":
            return {
                type: "share",
                ID: blob.legacy_attachment_id,
                url: blob.story_attachment ? blob.story_attachment.url : null,

                title: blob.story_attachment && blob.story_attachment.title_with_entities ? blob.story_attachment.title_with_entities.text : null,
                description: blob.story_attachment && blob.story_attachment.description &&
                    blob.story_attachment.description.text,
                source: blob.story_attachment && blob.story_attachment.source ? blob.story_attachment.source.text : null,

                image: blob.story_attachment && blob.story_attachment.media &&
                    blob.story_attachment.media.image &&
                    blob.story_attachment.media.image.uri,
                width: blob.story_attachment && blob.story_attachment.media &&
                    blob.story_attachment.media.image &&
                    blob.story_attachment.media.image.width,
                height: blob.story_attachment && blob.story_attachment.media &&
                    blob.story_attachment.media.image &&
                    blob.story_attachment.media.image.height,
                playable: blob.story_attachment && blob.story_attachment.media &&
                    blob.story_attachment.media.is_playable,
                duration: blob.story_attachment && blob.story_attachment.media &&
                    blob.story_attachment.media.playable_duration_in_ms,
                playableUrl: blob.story_attachment && blob.story_attachment.media == null ? null : blob.story_attachment.media.playable_url,

                subattachments: blob.story_attachment ? blob.story_attachment.subattachments : null,
                properties: blob.story_attachment && blob.story_attachment.properties ? blob.story_attachment.properties.reduce(function (/** @type {{ [x: string]: any; }} */obj, /** @type {{ key: string | number; value: { text: any; }; }} */cur) {
                    obj[cur.key] = cur.value.text;
                    return obj;
                }, {}) : null,

                facebookUrl: blob.story_attachment ? blob.story_attachment.url : null, // @Legacy
                target: blob.story_attachment ? blob.story_attachment.target : null, // @Legacy
                styleList: blob.story_attachment ? blob.story_attachment.style_list : null // @Legacy
            };
        case "MessageFile":
            return {
                type: "file",
                filename: blob.filename,
                ID: blob.message_file_fbid,

                url: blob.url,
                isMalicious: blob.is_malicious,
                contentType: blob.content_type,

                name: blob.filename,
                mimeType: "",
                fileSize: -1
            };
        default:
            throw new Error(
                "unrecognized attach_file of type " +
                type +
                "`" +
                JSON.stringify(attachment1, null, 4) +
                " attachment2: " +
                JSON.stringify(attachment2, null, 4) +
                "`"
            );
    }
}

function formatAttachment(attachments, attachmentIds, attachmentMap, shareMap) {
    attachmentMap = shareMap || attachmentMap;
    return attachments ?
        attachments.map(function (i) {
            if (!attachmentMap ||
                !attachmentIds ||
                !attachmentMap[attachmentIds[i]]
            ) {
                return _formatAttachment(val);
            }
            return _formatAttachment(val, attachmentMap[attachmentIds[i]]);
        }) : [];
}

/**
 * Facebook sends mention metadata in several different shapes depending on
 * the transport:
 *   - MQTT:        data.prng = '[{"i":"123","o":0,"l":5}]'
 *   - GraphQL:     ranges = [{ entity: { id: "123" }, offset: 0, length: 5 }]
 *   - some forks:  mentions = [{ userId: "123", offset: 0, length: 5 }]
 * A strict JSON.parse used to throw for the non-MQTT shapes, which
 * propagated out of formatDeltaMessage and silently dropped the whole
 * incoming message.  Always normalise instead of throwing.
 */
function isMentionRow(value) {
    if (!value || typeof value !== "object" || Array.isArray(value))
        return false;
    return value.i !== undefined || value.id !== undefined || value.uid !== undefined ||
        value.userID !== undefined || value.userId !== undefined || value.senderID !== undefined ||
        value.entity !== undefined || value.offset !== undefined || value.o !== undefined ||
        value.fromIndex !== undefined || value.tag !== undefined || value.name !== undefined;
}

function collectMentionRows(value, rows, depth) {
    if (value === undefined || value === null || depth > 5)
        return;
    if (typeof value === "string") {
        var text = value.trim();
        if (!text || text.length > 200000)
            return;
        if (text[0] === "[" || text[0] === "{" || text[0] === '"') {
            try {
                collectMentionRows(JSON.parse(text), rows, depth + 1);
            } catch (_) { }
        }
        return;
    }
    if (Array.isArray(value)) {
        for (var i = 0; i < value.length; i++)
            collectMentionRows(value[i], rows, depth + 1);
        return;
    }
    if (typeof value !== "object")
        return;

    // Containers produced by different FCA versions. Do not return early:
    // a payload can expose the same mentions in more than one place, and
    // missing one of them would leave a tag untranslated.
    if (Array.isArray(value.ranges)) {
        collectMentionRows(value.ranges, rows, depth + 1);
    }
    if (value.prng !== undefined && value.prng !== value) {
        collectMentionRows(value.prng, rows, depth + 1);
    }
    if (value.data !== undefined && value.data !== value) {
        collectMentionRows(value.data, rows, depth + 1);
    }
    if (value.mentions !== undefined && value.mentions !== value) {
        collectMentionRows(value.mentions, rows, depth + 1);
    }
    if (isMentionRow(value)) {
        rows.push(value);
        return;
    }

    // Plain map shape: { "123456789": "Name" }
    var keys = Object.keys(value);
    if (keys.length) {
        var numericKeys = 0;
        for (var k = 0; k < keys.length; k++) {
            if (/^[0-9]{5,}$/.test(normalizeMentionID(keys[k]) || ""))
                numericKeys++;
        }
        if (numericKeys === keys.length) {
            for (var n = 0; n < keys.length; n++)
                rows.push({ id: keys[n], name: value[keys[n]] });
        }
    }
}

function parseMentionData(data) {
    var rows = [];
    try {
        collectMentionRows(data, rows, 0);
    } catch (_) { }
    return rows;
}

// Some Facebook deltas encode scalar values as protobuf wrappers, e.g.
// { asLong: "615..." } or { asNumber: "0" }. Unwrap those before parsing,
// otherwise Number() on the wrapper object yields NaN and the mention
// loses its offset/length (and the ID field yields the wrapper itself).
function unwrapMentionScalar(value) {
    if (value && typeof value === "object") {
        if (value.asLong !== undefined) return unwrapMentionScalar(value.asLong);
        if (value.asNumber !== undefined) return unwrapMentionScalar(value.asNumber);
        if (value.long !== undefined) return unwrapMentionScalar(value.long);
        var keys = Object.keys(value);
        if (keys.length === 1 && keys[0] === "value")
            return unwrapMentionScalar(value.value);
    }
    return value;
}

function normalizeMentionID(id) {
    id = unwrapMentionScalar(id);
    if (id === undefined || id === null) return null;
    if (typeof id === "object") {
        return normalizeMentionID(
            id.id !== undefined ? id.id :
                id.userID !== undefined ? id.userID :
                    id.userId !== undefined ? id.userId :
                        id.uid !== undefined ? id.uid :
                            id.senderID !== undefined ? id.senderID :
                                id.fbid !== undefined ? id.fbid :
                                    id.entity !== undefined ? id.entity :
                                        id.entityId !== undefined ? id.entityId : undefined
        );
    }
    var value = String(id).trim();
    if (!value) return null;
    value = value.replace(/^(?:fbid|uid|user|facebook|id)[:.]/i, "").replace(/^@+/, "").trim();
    // E2EE JIDs look like "61568577897207:69@msgr".
    var jid = value.match(/^([0-9]{5,}):[^@]*@/);
    if (jid) value = jid[1];
    return value || null;
}

function firstMentionValue(row, keys) {
    for (var i = 0; i < keys.length; i++) {
        var value = row[keys[i]];
        if (value !== undefined && value !== null && value !== "")
            return value;
    }
    return undefined;
}

/**
 * Newer Facebook MQTT deltas sometimes omit `data.prng` and instead store
 * the mention map in the protobuf-ish
 * `messageMetadata.data.data.Gb.asMap.data` container. Each entry looks
 * like { asMap: { data: { id: { asLong }, offset: { asLong },
 * length: { asLong } } } }. A parser that only reads data.prng/mentions
 * sees no rows for this shape, so every incoming mention arrives empty.
 * Accepts both messageMetadata.data.Gb... and
 * messageMetadata.data.data.Gb... (the latter is what FB sends today).
 */
function parseMetadataMentions(metadata) {
    var rows = [];
    try {
        var root = metadata && metadata.data;
        if (typeof root === "string") {
            try { root = JSON.parse(root); } catch (_) { return rows; }
        }
        var nested = root && root.data !== undefined ? root.data : root;
        var map = nested && nested.Gb && nested.Gb.asMap && nested.Gb.asMap.data;
        if (!map || typeof map !== "object") return rows;

        var keys = Object.keys(map);
        for (var i = 0; i < keys.length; i++) {
            var entry = map[keys[i]];
            var item = entry && entry.asMap && entry.asMap.data;
            if (!item || typeof item !== "object") continue;
            var id = unwrapMentionScalar(item.id);
            var offset = unwrapMentionScalar(item.offset);
            var length = unwrapMentionScalar(item.length);
            if (id === undefined || offset === undefined || length === undefined)
                continue;
            rows.push({
                id: id,
                offset: offset,
                length: length,
                name: unwrapMentionScalar(item.name)
            });
        }
    } catch (_) { }
    return rows;
}

/**
 * Build the `mentions` map used by all commands.  Keys are always clean,
 * prefix-free user IDs.  Values are the exact substring from the body so
 * outgoing tags (tag + offset) match what the user typed.
 *
 * `extra` lets callers add another payload (for example `m.mentions` next to
 * `m.data.prng`) without calling this function twice. `metadata` adds the
 * messageMetadata fallback used by newer Facebook deltas.
 */
function formatMentions(data, body, extra, metadata) {
    var text = typeof body === "string" ? body : "";
    var sources = [data, extra];
    var rows = parseMentionData(sources);
    if (metadata) {
        var metadataRows = parseMetadataMentions(metadata);
        for (var r = 0; r < metadataRows.length; r++)
            rows.push(metadataRows[r]);
    }
    var mentions = {};
    for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        if (!row || typeof row !== "object") continue;

        var entity = row.entity;
        if (entity !== null && typeof entity === "object") {
            var entityID = firstMentionValue(entity, ["id", "userID", "userId", "uid", "senderID", "fbid"]);
            if (entityID !== undefined && row.id === undefined && row.i === undefined && row.uid === undefined)
                row = Object.assign({}, row, { id: entityID, name: row.name || entity.name });
        }
        else if (entity !== undefined && entity !== null && typeof entity !== "object" &&
            row.id === undefined && row.i === undefined && row.uid === undefined) {
            row = Object.assign({}, row, { id: entity });
        }

        var id = normalizeMentionID(firstMentionValue(row, [
            "i", "id", "uid", "userID", "userId", "senderID", "fbid"
        ]));
        if (!id || id === "0") continue;

        var offset = Number(unwrapMentionScalar(firstMentionValue(row, ["o", "offset", "fromIndex", "start", "position"])));
        var length = Number(unwrapMentionScalar(firstMentionValue(row, ["l", "length", "len", "size"])));
        var tag = "";
        if (Number.isFinite(offset) && offset >= 0) {
            if (Number.isFinite(length) && length > 0)
                tag = text.substr(offset, length);
            else {
                var fallbackTag = firstMentionValue(row, ["tag", "n", "name", "text", "displayName"]);
                if (typeof fallbackTag === "string" && fallbackTag)
                    tag = text.substr(offset, fallbackTag.length);
            }
        }
        if (!tag && typeof row.n === "string") tag = row.n;
        if (!tag && typeof row.tag === "string") tag = row.tag;
        if (!tag && typeof row.name === "string") tag = row.name;
        if (!tag && typeof row.text === "string") tag = row.text;
        if (!tag && typeof row.displayName === "string") tag = row.displayName;
        if (!tag && entity && typeof entity === "object" && typeof entity.name === "string") tag = entity.name;
        if (!tag) tag = "@" + id;
        mentions[id] = tag;
    }
    return mentions;
}

function formatDeltaMessage(m) {
    var md = m.messageMetadata || {};
    var threadKey = md.threadKey || {};
    var body = typeof m.body === "string" ? m.body : "";
    var args = body == "" ? [] : body.trim().split(/\s+/);
    return {
        type: "message",
        senderID: md.actorFbId != null ? formatID(md.actorFbId.toString()) : "",
        threadID: formatID(String(threadKey.threadFbId || threadKey.otherUserFbId || "")),
        messageID: md.messageId,
        args: args,
        body: body,
        attachments: (Array.isArray(m.attachments) ? m.attachments : []).map((/** @type {any} */v) => {
            try {
                return _formatAttachment(v);
            } catch (error) {
                return Object.assign({}, v, { type: "unknown", error: error });
            }
        }),
        mentions: formatMentions(m.data, body, m.mentions, md),
        timestamp: md.timestamp,
        isGroup: !!threadKey.threadFbId,
        participantIDs: Array.isArray(m.participants) ? m.participants : []
    };
}

function formatID(id) {
    if (id != undefined && id != null) return id.replace(/(fb)?id[:.]/, "");
    else return id;
}

function formatMessage(m) {
    var originalMessage = m.message ? m.message : m;
    var obj = {
        type: "message",
        senderName: originalMessage.sender_name,
        senderID: formatID(originalMessage.sender_fbid.toString()),
        participantNames: originalMessage.group_thread_info ? originalMessage.group_thread_info.participant_names : [originalMessage.sender_name.split(" ")[0]],
        participantIDs: originalMessage.group_thread_info ?
            originalMessage.group_thread_info.participant_ids.map(function (v) {
                return formatID(v.toString());
            }) : [formatID(originalMessage.sender_fbid)],
        body: originalMessage.body || "",
        threadID: formatID((originalMessage.thread_fbid || originalMessage.other_user_fbid).toString()),
        threadName: originalMessage.group_thread_info ? originalMessage.group_thread_info.name : originalMessage.sender_name,
        location: originalMessage.coordinates ? originalMessage.coordinates : null,
        messageID: originalMessage.mid ? originalMessage.mid.toString() : originalMessage.message_id,
        attachments: formatAttachment(
            originalMessage.attachments,
            originalMessage.attachmentIds,
            originalMessage.attachment_map,
            originalMessage.share_map
        ),
        timestamp: originalMessage.timestamp,
        timestampAbsolute: originalMessage.timestamp_absolute,
        timestampRelative: originalMessage.timestamp_relative,
        timestampDatetime: originalMessage.timestamp_datetime,
        tags: originalMessage.tags,
        reactions: originalMessage.reactions ? originalMessage.reactions : [],
        isUnread: originalMessage.is_unread
    };
    if (m.type === "pages_messaging") obj.pageID = m.realtime_viewer_fbid.toString();
    obj.isGroup = obj.participantIDs.length > 2;
    return obj;
}

function formatEvent(m) {
    var originalMessage = m.message ? m.message : m;
    var logMessageType = originalMessage.log_message_type;
    var logMessageData;
    if (logMessageType === "log:generic-admin-text") {
        logMessageData = originalMessage.log_message_data.untypedData;
        logMessageType = getAdminTextMessageType(originalMessage.log_message_data.message_type);
    } else logMessageData = originalMessage.log_message_data;
    return Object.assign(formatMessage(originalMessage), {
        type: "event",
        logMessageType: logMessageType,
        logMessageData: logMessageData,
        logMessageBody: originalMessage.log_message_body
    });
}

function formatHistoryMessage(m) {
    switch (m.action_type) {
        case "ma-type:log-message":
            return formatEvent(m);
        default:
            return formatMessage(m);
    }
}

function getAdminTextMessageType(m) {
    switch (m.type) {
        case "joinable_group_link_mode_change":
            return "log:link-status";
        case "magic_words":
            return "log:magic-words";
        case "change_thread_theme":
            return "log:thread-color";
        case "change_thread_icon":
        case "change_thread_quick_reaction":
            return "log:thread-icon";
        case "change_thread_nickname":
            return "log:user-nickname";
        case "change_thread_admins":
            return "log:thread-admins";
        case "group_poll":
            return "log:thread-poll";
        case "change_thread_approval_mode":
            return "log:thread-approval-mode";
        case "messenger_call_log":
        case "participant_joined_group_call":
            return "log:thread-call";
        case "pin_messages_v2":
            return "log:thread-pinned";
        case 'unpin_messages_v2':
            return 'log:unpin-message';
        default:
            return m.type;
    }
}

function formatDeltaEvent(m) {
    var logMessageType;
    var logMessageData;
    switch (m.class) {
        case "AdminTextMessage":
            logMessageType = getAdminTextMessageType(m);
            logMessageData = m.untypedData;
            break;
        case "ThreadName":
            logMessageType = "log:thread-name";
            logMessageData = { name: m.name };
            break;
        case "ParticipantsAddedToGroupThread":
            logMessageType = "log:subscribe";
            logMessageData = { addedParticipants: m.addedParticipants };
            break;
        case "ParticipantLeftGroupThread":
            logMessageType = "log:unsubscribe";
            logMessageData = { leftParticipantFbId: m.leftParticipantFbId };
            break;
        case "UserLocation": {
            logMessageType = "log:user-location";
            logMessageData = {
                Image: m.attachments[0].mercury.extensible_attachment.story_attachment.media.image,
                Location: m.attachments[0].mercury.extensible_attachment.story_attachment.target.location_title,
                coordinates: m.attachments[0].mercury.extensible_attachment.story_attachment.target.coordinate,
                url: m.attachments[0].mercury.extensible_attachment.story_attachment.url
            };
        }
        case "ApprovalQueue":
            logMessageType = "log:approval-queue";
            logMessageData = {
                approvalQueue: {
                    action: m.action,
                    recipientFbId: m.recipientFbId,
                    requestSource: m.requestSource,
                    ...m.messageMetadata
                }
            };
    }
    return {
        type: "event",
        threadID: formatID((m.messageMetadata.threadKey.threadFbId || m.messageMetadata.threadKey.otherUserFbId).toString()),
        logMessageType: logMessageType,
        logMessageData: logMessageData,
        logMessageBody: m.messageMetadata.adminText,
        author: m.messageMetadata.actorFbId,
        participantIDs: (m?.participants || []).map((e) => e.toString())
    };
}

function formatTyp(event) {
    return {
        isTyping: !!event.st,
        from: event.from.toString(),
        threadID: formatID((event.to || event.thread_fbid || event.from).toString()),
        fromMobile: event.hasOwnProperty("from_mobile") ? event.from_mobile : true,
        userID: (event.realtime_viewer_fbid || event.from).toString(),
        type: "typ"
    };
}

function formatDeltaReadReceipt(delta) {
    return {
        reader: (delta.threadKey.otherUserFbId || delta.actorFbId).toString(),
        time: delta.actionTimestampMs,
        threadID: formatID((delta.threadKey.otherUserFbId || delta.threadKey.threadFbId).toString()),
        type: "read_receipt"
    };
}

function formatReadReceipt(event) {
    return {
        reader: event.reader.toString(),
        time: event.time,
        threadID: formatID((event.thread_fbid || event.reader).toString()),
        type: "read_receipt"
    };
}

function formatRead(event) {
    return {
        threadID: formatID(((event.chat_ids && event.chat_ids[0]) || (event.thread_fbids && event.thread_fbids[0])).toString()),
        time: event.timestamp,
        type: "read"
    };
}

function getFrom(html, a, b) {
    const i = html.indexOf(a);
    if (i < 0) return;
    const start = i + a.length;
    const j = html.indexOf(b, start);
    return j < 0 ? undefined : html.slice(start, j);
}

function getFroms(str, startToken, endToken) {
    let results = [];
    let currentIndex = 0;
    while (true) {
        let start = str.indexOf(startToken, currentIndex);
        if (start === -1) break;
        start += startToken.length;
        let lastHalf = str.substring(start);
        let end = lastHalf.indexOf(endToken);
        if (end === -1) {
            if (results.length === 0) {
                throw Error("Could not find endToken `" + endToken + "` in the given string.");
            }
            break;
        }
        results.push(lastHalf.substring(0, end));
        currentIndex = start + end + endToken.length;
    }
    return results.length === 0 ? "" : results.length === 1 ? results[0] : results;
}

function makeParsable(html) {
    let withoutForLoop = html.replace(/for\s*\(\s*;\s*;\s*\)\s*;\s*/, "");
    let maybeMultipleObjects = withoutForLoop.split(/\}\r\n *\{/);
    if (maybeMultipleObjects.length === 1) return maybeMultipleObjects;
    return "[" + maybeMultipleObjects.join("},{") + "]";
}

function arrToForm(form) {
    return arrayToObject(form,
        function (v) {
            return v.name;
        },
        function (v) {
            return v.val;
        }
    );
}

function arrayToObject(arr, getKey, getValue) {
    return arr.reduce(function (acc, val) {
        acc[getKey(val)] = getValue(val);
        return acc;
    }, {});
}

function getSignatureID() {
    return Math.floor(Math.random() * 2147483648).toString(16);
}

function generateTimestampRelative() {
    var d = new Date();
    return d.getHours() + ":" + padZeros(d.getMinutes());
}

function makeDefaults(html, userID, ctx) {
    var reqCounter = 1;
    let fb_dtsg = null;

    // Robust fb_dtsg extraction
    const dtsgRegexes = [
        /"DTSGInitData",\[\],{"token":"(.*?)"/,
        /"DTSGInitialData",\[\],{"token":"(.*?)"/,
        /DTSGInitialData.*?token":"(.*?)"/,
        /\["DTSGInitData",\[\],{"token":"(.*?)"/,
        /name="fb_dtsg" value="(.*?)"/,
        /name="dtsg_ag" value="(.*?)"/
    ];

    for (const regex of dtsgRegexes) {
        const match = html.match(regex);
        if (match && match[1]) {
            fb_dtsg = match[1];
            break;
        }
    }

    // Fallback to ctx if not found in HTML (or if HTML is partial)
    if (!fb_dtsg && ctx.fb_dtsg) {
        fb_dtsg = ctx.fb_dtsg;
    }

    var ttstamp = "2";
    if (fb_dtsg) {
        for (var i = 0; i < fb_dtsg.length; i++) ttstamp += fb_dtsg.charCodeAt(i);
    }

    var revision = getFrom(html, 'revision":', ",");
    function mergeWithDefaults(obj) {
        var newObj = {
            __user: userID,
            __req: (reqCounter++).toString(36),
            __rev: revision,
            __a: 1,
            fb_dtsg: ctx.fb_dtsg ? ctx.fb_dtsg : fb_dtsg,
            jazoest: ctx.ttstamp ? ctx.ttstamp : ttstamp
        };
        if (!obj) return newObj;
        for (var prop in obj)
            if (obj.hasOwnProperty(prop))
                if (!newObj[prop]) newObj[prop] = obj[prop];
        return newObj;
    }
    function postWithDefaults(url, jar, form, ctxx) {
        return post(url, jar, mergeWithDefaults(form), ctx.globalOptions, ctxx || ctx);
    }
    function getWithDefaults(url, jar, qs, ctxx) {
        return get(url, jar, mergeWithDefaults(qs), ctx.globalOptions, ctxx || ctx);
    }
    function postFormDataWithDefault(url, jar, form, qs, ctxx) {
        // A form factory must stay a factory so retries can rebuild the
        // multipart body instead of reusing a consumed stream.
        const formWithDefaults =
            typeof form === "function"
                ? function () {
                      const built = form();
                      return isFormData(built) ? built : mergeWithDefaults(built);
                  }
                : mergeWithDefaults(form);
        return postFormData(url, jar, formWithDefaults, mergeWithDefaults(qs), ctx.globalOptions, ctxx || ctx);
    }
    return {
        get: getWithDefaults,
        post: postWithDefaults,
        postFormData: postFormDataWithDefault
    };
}

function parseAndCheckLogin(ctx, defaultFuncs, retryCount = 0, sourceCall) {
    if (sourceCall === undefined) {
        try {
            throw new Error();
        } catch (e) {
            sourceCall = e;
        }
    }
    return function (data) {
        return tryPromise(function () {
            log.verbose("parseAndCheckLogin", data.body);

            // GOT compatibility: map request properties
            const request = data.request;
            const requestUrl = request.options ? request.options.url : request.uri;
            const requestMethod = request.options ? request.options.method : request.method;
            const requestHeaders = request.options ? request.options.headers : request.headers;
            const requestBody = request.options ? (request.options.form || request.options.body) : (request.formData || request.form);

            // --- Handle HTTP 5xx with bounded retry (existing logic) ---
            if (data.statusCode >= 500 && data.statusCode < 600) {
                if (retryCount >= 5) {
                    throw {
                        message: "Request retry failed. Check `res` and `statusCode`.",
                        statusCode: data.statusCode,
                        res: data.body,
                        error: "Request retry failed.",
                        sourceCall
                    };
                }
                retryCount++;
                const retryTime = Math.floor(Math.random() * 5000);
                log.warn(
                    "parseAndCheckLogin",
                    `Got status code ${data.statusCode} - Retrying in ${retryTime}ms...`
                );

                const url = requestUrl.toString();
                const contentType = requestHeaders?.["content-type"]?.split(";")[0];

                return delay(retryTime)
                    .then(() => {
                        if (contentType === "multipart/form-data") {
                            // A multipart body is one-shot. Only retry when
                            // postFormData gave us a factory that can rebuild
                            // it; replaying a consumed stream uploads an empty
                            // body and Facebook answers 400.
                            const formFactory = requestBody && requestBody._nexusFormFactory;
                            if (typeof formFactory !== "function") {
                                throw {
                                    message: "Cannot retry a consumed multipart upload body.",
                                    statusCode: data.statusCode,
                                    res: data.body,
                                    error: "Non-replayable multipart body.",
                                    sourceCall
                                };
                            }
                            return defaultFuncs.postFormData(url, ctx.jar, formFactory, {});
                        }
                        return defaultFuncs.post(url, ctx.jar, requestBody);
                    })
                    .then(parseAndCheckLogin(ctx, defaultFuncs, retryCount, sourceCall));
            }
            // --- New: Explicit 3xx redirect handling (302 login checkpoint, etc.) ---
            if (data.statusCode >= 300 && data.statusCode < 400) {
                const location = data.headers && (data.headers.location || data.headers.Location);
                if (!location) {
                    throw {
                        message: `Redirect (${data.statusCode}) without location header.`,
                        statusCode: data.statusCode,
                        res: data.body,
                        error: "Redirect without location.",
                        sourceCall
                    };
                }
                // Detect checkpoint/login redirects explicitly
                if (/checkpoint|login|recover/i.test(location)) {
                    throw {
                        message: `Redirected to login/checkpoint: ${location}`,
                        statusCode: data.statusCode,
                        location,
                        error: "Not logged in.",
                        type: "login_redirect",
                        res: data.body,
                        sourceCall
                    };
                }
                log.warn("parseAndCheckLogin", `Following redirect -> ${location}`);
                return defaultFuncs.get(location, ctx.jar)
                    .then(parseAndCheckLogin(ctx, defaultFuncs, retryCount, sourceCall));
            }
            if (data.statusCode !== 200) {
                throw {
                    message: `parseAndCheckLogin got status code: ${data.statusCode}.`,
                    statusCode: data.statusCode,
                    res: data.body,
                    error: `parseAndCheckLogin got status code: ${data.statusCode}.`,
                    sourceCall
                };
            }
            let res;
            let bodyText = data.body || "";
            // --- New: Detect full HTML (often login page) before JSON parse ---
            const looksLikeHTML = /<html[\s\S]*<\/html>/i.test(bodyText);
            if (looksLikeHTML && /login|checkpoint|password|m_faceweb|m\.facebook\.com\/login/i.test(bodyText)) {
                throw {
                    message: "Received HTML login/checkpoint page instead of JSON (session likely invalid).",
                    statusCode: data.statusCode,
                    res: bodyText.slice(0, 5000),
                    error: "Not logged in.",
                    type: "html_login_page",
                    sourceCall
                };
            }
            try {
                res = JSON.parse(makeParsable(bodyText));
            } catch (e) {
                // Additional heuristic: if body has FB login form markers
                if (/login_form|checkpointSubmitButton|memorialized/i.test(bodyText)) {
                    throw {
                        message: "Facebook returned login/checkpoint HTML instead of JSON.",
                        detail: e.message,
                        res: bodyText.slice(0, 5000),
                        error: "Not logged in.",
                        type: "html_login_page_parse_fail",
                        sourceCall
                    };
                }
                log.error("JSON parsing failed:", bodyText);
                throw {
                    message: "Failed to parse JSON response.",
                    detail: e.message,
                    res: bodyText.slice(0, 5000),
                    error: "JSON.parse error.",
                    sourceCall
                };
            }
            if (res.redirect && requestMethod === "GET") {
                // New: classify redirect target
                if (/checkpoint|login/i.test(res.redirect)) {
                    throw {
                        message: `Redirected to login/checkpoint (JSON redirect): ${res.redirect}`,
                        statusCode: data.statusCode,
                        location: res.redirect,
                        error: "Not logged in.",
                        type: "login_redirect",
                        res,
                        sourceCall
                    };
                }
                return defaultFuncs
                    .get(res.redirect, ctx.jar)
                    .then(parseAndCheckLogin(ctx, defaultFuncs, undefined, sourceCall));
            }
            // --- Existing cookie & token handling logic (unchanged) ---
            if (
                res.jsmods?.require &&
                Array.isArray(res.jsmods.require[0]) &&
                res.jsmods.require[0][0] === "Cookie"
            ) {
                res.jsmods.require[0][3][0] = res.jsmods.require[0][3][0].replace("_js_", "");
                const cookie = formatCookie(res.jsmods.require[0][3], "facebook");
                const cookie2 = formatCookie(res.jsmods.require[0][3], "messenger");
                ctx.jar.setCookie(cookie, "https://www.facebook.com");
                ctx.jar.setCookie(cookie2, "https://www.messenger.com");
            }
            if (res.jsmods?.require) {
                for (const arr of res.jsmods.require) {
                    if (arr[0] === "DTSG" && arr[1] === "setToken") {
                        ctx.fb_dtsg = arr[3][0];
                        ctx.ttstamp = "2" + ctx.fb_dtsg.split("").map(c => c.charCodeAt(0)).join("");
                    }
                }
            }
            // --- New: Detect common not-logged-in payload patterns ---
            if (res.error === 1357001 || res.error === 1357004 || res.errorSummary === "login required") {
                throw {
                    message: "Facebook blocked login. Please check your account or re-login.",
                    error: "Not logged in.",
                    res,
                    statusCode: data.statusCode,
                    sourceCall
                };
            }
            return res;
        });
    };
}
function saveCookies(jar, ctx) {
    return function (res) {
        var cookies = res.headers["set-cookie"] || [];
        if (cookies.length === 0) return res;

        cookies.forEach(function (c) {
            if (c.indexOf(".facebook.com") > -1 || c.indexOf("facebook.com") > -1) {
                try {
                    jar.setCookie(c, "https://www.facebook.com");
                } catch (e) { }

                try {
                    var c_messenger = c.replace(/domain=\.?facebook\.com/i, "domain=.messenger.com");
                    if (c_messenger.indexOf(".messenger.com") > -1) {
                        jar.setCookie(c_messenger, "https://www.messenger.com");
                    }
                } catch (e) { }
            }
        });

        // AUTO-PERSISTENCE: persist cookie changes when the session file
        // path is known. Throttled: busy sessions receive Set-Cookie on
        // most responses and a synchronous write per response wastes disk
        // I/O on the hot request path, so at most one write happens per
        // 10 seconds, with a trailing flush so the latest cookie state
        // still lands on disk.
        if (ctx && ctx.appStatePath) {
            const now = Date.now();
            const last = ctx._appStateSavedAt || 0;
            if (now - last >= 10000) {
                ctx._appStateSavedAt = now;
                saveAppState(ctx);
            } else if (!ctx._appStateSaveTimer) {
                ctx._appStateSaveTimer = setTimeout(function () {
                    ctx._appStateSaveTimer = null;
                    ctx._appStateSavedAt = Date.now();
                    saveAppState(ctx);
                }, 10000 - (now - last));
                if (typeof ctx._appStateSaveTimer.unref === "function") ctx._appStateSaveTimer.unref();
            }
        }

        return res;
    };
}

function saveAppState(ctx) {
    if (!ctx || !ctx.jar || !ctx.appStatePath) return;
    try {
        const appState = getAppState(ctx.jar);
        if (!isSafeAppState(appState)) {
            log.warn("utils", "saveAppState: incomplete cookie set (missing c_user/xs) — keeping the existing appstate file");
            return;
        }
        const fs = require('fs');
        const path = require('path');

        // Ensure directory exists
        const dir = path.dirname(ctx.appStatePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        // Atomic write: a process killed mid-write (host restart, crash,
        // process.exit) must never leave a truncated appstate.json — that
        // would break the next login until the user re-exports cookies.
        // Write to a temp file and rename, falling back to a direct write
        // if the platform refuses the rename.
        const tmpPath = ctx.appStatePath + '.tmp';
        const payload = JSON.stringify(appState, null, 2);
        try {
            fs.writeFileSync(tmpPath, payload);
            try {
                fs.renameSync(tmpPath, ctx.appStatePath);
            } catch (renameErr) {
                fs.copyFileSync(tmpPath, ctx.appStatePath);
                try { fs.unlinkSync(tmpPath); } catch (_) { }
            }
        } catch (writeErr) {
            fs.writeFileSync(ctx.appStatePath, payload);
        }
        ctx._appStateSavedAt = Date.now();

        // Optional: Mirror to environment-ready file for cloud platforms
        const envPath = ctx.appStatePath.replace('.json', '.env.json');
        if (process.env.NEXUS_SYNC_ENV_FILE === '1') {
            fs.writeFileSync(envPath, JSON.stringify(appState));
        }

        // EXTERNAL PERSISTENCE: If NEXUS_EXTERNAL_SAVE_URL is set, POST there
        if (process.env.NEXUS_EXTERNAL_SAVE_URL) {
            const axios = require('axios');
            axios.post(process.env.NEXUS_EXTERNAL_SAVE_URL, appState, {
                headers: { 'Content-Type': 'application/json', 'User-Agent': 'Nexus-FCA-Persistence' },
                timeout: 10000
            }).catch(err => {
                log.verbose("utils", "External appstate sync failed: " + err.message);
            });
        }

        // NEXUS SESSION VAULT (save side): mirror every refreshed session to
        // NEXUS_SESSION_VAULT_URL so a restart on an ephemeral host boots
        // with the FRESHEST cookies instead of the frozen APPSTATE_JSON
        // bootstrap. The restore side lives in the bot
        // (bot/login/sessionVault.js) — the library cannot require bot code,
        // so the small header/method contract is mirrored here:
        // token -> Authorization Bearer + X-Master-Key; PUT for jsonbin-style
        // stores with a POST fallback (payload shape { appState, savedAt,
        // source }). Fire-and-forget: a vault outage must never delay the
        // runtime save.
        if (process.env.NEXUS_SESSION_VAULT_URL) {
            try {
                const axios = require('axios');
                const vaultUrl = process.env.NEXUS_SESSION_VAULT_URL;
                // QUOTA GUARD: the local file write is disk-cheap (10 s
                // throttle), but a vault PUT costs a remote API request —
                // jsonbin's free tier allows ~10k requests/month. So the
                // vault only sees the state when the rotating cookies
                // actually changed, or at most once per 5 minutes.
                const vaultFp = appState
                    .filter(c => c && ['xs', 'fr', 'c_user'].includes(c.key))
                    .map(c => c.key + '=' + c.value)
                    .join('|');
                const vaultFresh = ctx._vaultSavedFp !== vaultFp
                    || !ctx._vaultSavedAt
                    || (Date.now() - ctx._vaultSavedAt) > 300000;
                if (!vaultFresh) return;
                ctx._vaultSavedFp = vaultFp;
                ctx._vaultSavedAt = Date.now();
                const vaultHeaders = { 'Content-Type': 'application/json', 'User-Agent': 'Nexus-SessionVault/1.0' };
                if (process.env.NEXUS_SESSION_VAULT_TOKEN) {
                    vaultHeaders['Authorization'] = 'Bearer ' + process.env.NEXUS_SESSION_VAULT_TOKEN;
                    vaultHeaders['X-Master-Key'] = process.env.NEXUS_SESSION_VAULT_TOKEN;
                }
                const vaultPayload = { appState: appState, savedAt: new Date().toISOString(), source: 'nexus-fca' };
                const forcedMethod = (process.env.NEXUS_SESSION_VAULT_METHOD || '').toUpperCase();
                const preferPut = forcedMethod === 'PUT' || (!forcedMethod && /jsonbin\.io/.test(vaultUrl));
                const vaultMethods = preferPut ? ['put', 'post'] : ['post', 'put'];
                (async () => {
                    for (const method of vaultMethods) {
                        try {
                            const res = await axios({
                                url: vaultUrl,
                                method: method,
                                data: vaultPayload,
                                headers: vaultHeaders,
                                timeout: 10000,
                                validateStatus: () => true
                            });
                            if (res && res.status < 400) return;
                        } catch (_) { }
                    }
                    log.verbose("utils", "Session vault save failed (all methods)");
                })();
            } catch (vaultErr) {
                log.verbose("utils", "Session vault save failed: " + (vaultErr && vaultErr.message ? vaultErr.message : vaultErr));
            }
        }
    } catch (e) {
        log.verbose("utils", "Auto-save appstate failed: " + e.message);
    }
}

var NUM_TO_MONTH = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec"
];
var NUM_TO_DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatDate(date) {
    var d = date.getUTCDate();
    d = d >= 10 ? d : "0" + d;
    var h = date.getUTCHours();
    h = h >= 10 ? h : "0" + h;
    var m = date.getUTCMinutes();
    m = m >= 10 ? m : "0" + m;
    var s = date.getUTCSeconds();
    s = s >= 10 ? s : "0" + s;
    return (NUM_TO_DAY[date.getUTCDay()] + ", " + d + " " + NUM_TO_MONTH[date.getUTCMonth()] + " " + date.getUTCFullYear() + " " + h + ":" + m + ":" + s + " GMT");
}

function formatCookie(arr, url) {
    return arr[0] + "=" + arr[1] + "; Path=" + arr[3] + "; Domain=" + url + ".com";
}

function formatThread(data) {
    return {
        threadID: formatID(data.thread_fbid.toString()),
        participants: data.participants.map(formatID),
        participantIDs: data.participants.map(formatID),
        name: data.name,
        nicknames: data.custom_nickname,
        snippet: data.snippet,
        snippetAttachments: data.snippet_attachments,
        snippetSender: formatID((data.snippet_sender || "").toString()),
        unreadCount: data.unread_count,
        messageCount: data.message_count,
        imageSrc: data.image_src,
        timestamp: data.timestamp,
        muteUntil: data.mute_until,
        isCanonicalUser: data.is_canonical_user,
        isCanonical: data.is_canonical,
        isSubscribed: data.is_subscribed,
        folder: data.folder,
        isArchived: data.is_archived,
        recipientsLoadable: data.recipients_loadable,
        hasEmailParticipant: data.has_email_participant,
        readOnly: data.read_only,
        canReply: data.can_reply,
        cannotReplyReason: data.cannot_reply_reason,
        lastMessageTimestamp: data.last_message_timestamp,
        lastReadTimestamp: data.last_read_timestamp,
        lastMessageType: data.last_message_type,
        emoji: data.custom_like_icon,
        color: data.custom_color,
        adminIDs: data.admin_ids,
        threadType: data.thread_type
    };
}

function getType(obj) {
    return Object.prototype.toString.call(obj).slice(8, -1);
}

function formatProxyPresence(presence, userID) {
    if (presence.lat === undefined || presence.p === undefined) return null;
    return {
        type: "presence",
        timestamp: presence.lat * 1000,
        userID: userID || '',
        statuses: presence.p
    };
}

function formatPresence(presence, userID) {
    return {
        type: "presence",
        timestamp: presence.la * 1000,
        userID: userID || '',
        statuses: presence.a
    };
}

function decodeClientPayload(payload) {
    function Utf8ArrayToStr(array) {
        var out, i, len, c;
        var char2, char3;
        out = "";
        len = array.length;
        i = 0;
        while (i < len) {
            c = array[i++];
            switch (c >> 4) {
                case 0:
                case 1:
                case 2:
                case 3:
                case 4:
                case 5:
                case 6:
                case 7:
                    out += String.fromCharCode(c);
                    break;
                case 12:
                case 13:
                    char2 = array[i++];
                    out += String.fromCharCode(((c & 0x1F) << 6) | (char2 & 0x3F));
                    break;
                case 14:
                    char2 = array[i++];
                    char3 = array[i++];
                    out += String.fromCharCode(((c & 0x0F) << 12) | ((char2 & 0x3F) << 6) | ((char3 & 0x3F) << 0));
                    break;
            }
        }
        return out;
    }
    return JSON.parse(Utf8ArrayToStr(payload));
}

/**
 * Repair any cookie in the jar whose expires field is not a Date or
 * "Infinity". Uses the store's getAllCookies (no expiry matching), so
 * it is safe to run even when a bad cookie would otherwise make every
 * getCookies call throw. Returns the number of repaired cookies.
 */
async function sanitizeCookieJar(jar) {
    if (!jar || !jar.store || typeof jar.store.getAllCookies !== "function") return 0;
    const stored = await new Promise((resolve) => {
        try {
            jar.store.getAllCookies((err, list) => resolve(err ? [] : (list || [])));
        } catch (_) {
            resolve([]);
        }
    });
    let fixed = 0;
    for (const cookie of stored) {
        if (!cookie) continue;
        const raw = cookie.expires;
        const fixedValue = normalizeCookieExpiry(raw);
        if (fixedValue !== raw) {
            cookie.expires = fixedValue;
            fixed++;
        }
    }
    return fixed;
}

/**
 * A cookie set is only safe to persist when the session core is intact.
 * Saving a set that lost c_user/xs would silently destroy a working
 * session file (the exact failure reported in the field), so writers
 * check this gate before touching the appstate file.
 */
function isSafeAppState(appState) {
    if (!Array.isArray(appState) || appState.length === 0) return false;
    const keys = new Set(appState.map((c) => c && c.key).filter(Boolean));
    return keys.has("c_user") && keys.has("xs");
}

function getAppState(jar) {
    const all = jar.getCookies("https://www.facebook.com")
        .concat(jar.getCookies("https://facebook.com"))
        .concat(jar.getCookies("https://www.messenger.com"));    // Dedupe: cookies with domain=.facebook.com show up under both the www and
    // apex URL lookups. Duplicate entries made the saved appstate messy.
    const seen = new Set();
    return all.filter(c => {
        const sig = `${c.key}|${c.domain}|${c.path}|${c.value}`;
        if (seen.has(sig)) return false;
        seen.add(sig);
        return true;
    });
}

function getData_Path(Obj, Arr, Stt) {
    if (Arr.length === 0 && Obj != undefined) {
        return Obj;
    }
    else if (Obj == undefined) {
        return Stt;
    }
    const head = Arr[0];
    if (head == undefined) {
        return Stt;
    }
    const tail = Arr.slice(1);
    return getData_Path(Obj[head], tail, Stt++);
}

function setData_Path(obj, path, value) {
    if (!path.length) {
        return obj;
    }
    const currentKey = path[0];
    let currentObj = obj[currentKey];

    if (!currentObj) {
        obj[currentKey] = value;
        currentObj = obj[currentKey];
    }
    path.shift();
    if (!path.length) {
        currentObj = value;
    } else {
        currentObj = setData_Path(currentObj, path, value);
    }

    return obj;
}

function getPaths(obj, parentPath = []) {
    let paths = [];
    for (let prop in obj) {
        if (typeof obj[prop] === "object") {
            paths = paths.concat(getPaths(obj[prop], [...parentPath, prop]));
        } else {
            paths.push([...parentPath, prop]);
        }
    }
    return paths;
}

function cleanHTML(text) {
    text = text.replace(/(<br>)|(<\/?i>)|(<\/?em>)|(<\/?b>)|(!?~)|(&amp;)|(&#039;)|(&lt;)|(&gt;)|(&quot;)/g, (match) => {
        switch (match) {
            case "<br>":
                return "\n";
            case "<i>":
            case "<em>":
            case "</i>":
            case "</em>":
                return "*";
            case "<b>":
            case "</b>":
                return "**";
            case "~!":
            case "!~":
                return "||";
            case "&amp;":
                return "&";
            case "&#039;":
                return "'";
            case "&lt;":
                return "<";
            case "&gt;":
                return ">";
            case "&quot;":
                return '"';
        }
    });
    return text;
}

function checkLiveCookie(ctxOrInput, defaultFuncs) {
    // SESSIONLESS liveness probe (neokex-fca `login.utils.checkLiveCookie`
    // parity, implemented locally — cookies never leave this machine):
    // accepts an exported cookie array, a raw cookie string, cookies.txt
    // (Netscape) or a jar-like object, and reports whether the set still
    // authenticates, without creating a session or writing anything.
    if (defaultFuncs === undefined) {
        return require("./lib/safety/cookieLiveness").checkLiveCookie(ctxOrInput);
    }
    // Legacy session-based check (used internally by the listener): requires
    // an active (ctx, defaultFuncs) pair.
    return defaultFuncs.get("https://m.facebook.com/me", ctxOrInput.jar).then(function (res) {
        if (res.body.indexOf(ctxOrInput.userID) === -1) {
            throw new CustomError({
                message: "Not logged in.",
                error: "Not logged in."
            });
        }
        return true;
    });
}

// --- Nexus-FCA Advanced Safety Utilities ---

/**
 * Advanced Safety System for Ultra-Low Ban Rate
 * Intelligent request management to minimize Facebook account risks
 */
const smartSafetyLimiter = {
    userSessions: {},
    _pruneAt: 0,

    // Human-like delay patterns to avoid detection
    humanDelays: {
        typing: { min: 800, max: 2000 },
        reading: { min: 1000, max: 3000 },
        thinking: { min: 2000, max: 5000 },
        browsing: { min: 500, max: 1500 }
    },

    // Risk level assessment
    assessRisk(userID, action) {
        if (!this.userSessions[userID]) {
            this.userSessions[userID] = {
                requestCount: 0,
                errorCount: 0,
                lastActivity: Date.now(),
                riskLevel: 'low'
            };
        }

        // NEXUS PRODUCTION: prune idle sessions so this table can't grow
        // unbounded over months of uptime with thousands of users/threads.
        // Runs at most every 5 minutes; entries idle > 1h are dropped.
        const nowPrune = Date.now();
        if (this._pruneAt < nowPrune) {
            this._pruneAt = nowPrune + 5 * 60 * 1000;
            for (const key of Object.keys(this.userSessions)) {
                if (nowPrune - this.userSessions[key].lastActivity > 60 * 60 * 1000) {
                    delete this.userSessions[key];
                }
            }
        }

        const session = this.userSessions[userID];
        const timeSinceLastActivity = Date.now() - session.lastActivity;
        const errorRate = session.errorCount / Math.max(1, session.requestCount);

        // Update risk level based on activity patterns - ULTRA SAFE TUNING
        if (errorRate > 0.2 || timeSinceLastActivity < 800) { // Stricter error threshold (0.2 vs 0.3)
            session.riskLevel = 'high';
        } else if (errorRate > 0.05 || timeSinceLastActivity < 2000) { // Stricter medium threshold
            session.riskLevel = 'medium';
        } else {
            session.riskLevel = 'low';
        }

        return session.riskLevel;
    },

    // Get safe delay based on risk level and action type
    getSafeDelay(userID, action = 'browsing') {
        const riskLevel = this.assessRisk(userID, action);
        const baseDelay = this.humanDelays[action] || this.humanDelays.browsing;

        // Risk multipliers for safety
        const riskMultipliers = {
            'low': 1,
            'medium': 1.5,
            'high': 2.5
        };

        const multiplier = riskMultipliers[riskLevel] || 1;
        const min = baseDelay.min * multiplier;
        const max = baseDelay.max * multiplier;

        // Generate human-like random delay
        const baseDelayTime = Math.random() * (max - min) + min;
        const humanVariation = baseDelayTime * 0.1 * (Math.random() - 0.5);

        return Math.max(200, Math.floor(baseDelayTime + humanVariation));
    },

    // Record activity for safety metrics
    recordActivity(userID, isError = false) {
        if (!this.userSessions[userID]) {
            this.userSessions[userID] = {
                requestCount: 0,
                errorCount: 0,
                lastActivity: Date.now(),
                riskLevel: 'low'
            };
        }

        const session = this.userSessions[userID];
        session.requestCount++;
        session.lastActivity = Date.now();

        if (isError) {
            session.errorCount++;
        }

        // Auto-reset metrics every hour to prevent false risk escalation
        if (session.requestCount > 100) {
            session.requestCount = Math.floor(session.requestCount / 2);
            session.errorCount = Math.floor(session.errorCount / 2);
        }
    },

    // Check if action is safe to proceed
    isSafeToExecute(userID, action) {
        const riskLevel = this.assessRisk(userID, action);

        // Always allow low risk actions
        if (riskLevel === 'low') return true;

        // For higher risk, check recent activity
        const session = this.userSessions[userID];
        const timeSinceLastActivity = Date.now() - session.lastActivity;

        // Medium risk: ensure some delay between actions
        if (riskLevel === 'medium' && timeSinceLastActivity < 3000) {
            return false;
        }

        // High risk: require longer delays
        if (riskLevel === 'high' && timeSinceLastActivity < 10000) {
            return false;
        }

        return true;
    }
};

/**
 * Facebook Safety Mode: Enhanced protection against bans
 * Set process.env.NEXUS_FCA_ULTRA_SAFE_MODE = '1' to enable maximum protection
 */
const ultraSafeMode = process.env.NEXUS_FCA_ULTRA_SAFE_MODE === '1';
const safeMode = process.env.NEXUS_FCA_SAFE_MODE === '1' || ultraSafeMode;

/**
 * Account protection lists for enhanced safety
 */
const allowList = process.env.NEXUS_FCA_ALLOW_LIST ? process.env.NEXUS_FCA_ALLOW_LIST.split(',') : null;
const blockList = process.env.NEXUS_FCA_BLOCK_LIST ? process.env.NEXUS_FCA_BLOCK_LIST.split(',') : null;

function isUserAllowed(userID) {
    if (blockList && blockList.includes(userID)) return false;
    if (allowList && !allowList.includes(userID)) return false;
    return true;
}

// Legacy rate limiter - kept for backward compatibility but optimized for safety
const rateLimiter = {
    limits: {},
    windowMs: 60 * 1000,
    max: 20,
    check(userID, action) {
        // Use smart safety limiter instead of blocking
        return smartSafetyLimiter.isSafeToExecute(userID, action);
    }
};

// Add robust session validation utility used by listenMqtt
async function validateSession(ctx, defaultFuncs, opts = {}) {
    const { retries = 0, delayMs = 750 } = opts || {};
    if (!ctx || !ctx.jar) {
        throw new CustomError({ message: 'No context/jar provided', type: 'not_logged_in' });
    }
    const cookies = ctx.jar.getCookies('https://www.facebook.com');
    const hasUser = cookies.some(c => (c.key || c.name) === 'c_user');
    if (!hasUser) {
        throw new CustomError({ message: 'Not logged in (missing c_user cookie)', type: 'not_logged_in' });
    }

    const endpoints = [
        'https://www.facebook.com/ajax/mercury/threadlist_info.php?client=mercury',
        'https://m.facebook.com/me'
    ];

    function isHtmlLoginPage(body) {
        if (!body || typeof body !== 'string') return false;
        if (body.length < 40) return false;
        const lowered = body.toLowerCase();
        return (
            (lowered.includes('login') && lowered.includes('password')) ||
            lowered.includes('m_login_email') ||
            lowered.includes('/login/device-based')
        );
    }

    for (let attempt = 0; attempt <= retries; attempt++) {
        let allPassed = true;
        for (const url of endpoints) {
            try {
                // Prefer provided defaultFuncs.get if available (applies defaults & fb_dtsg)
                const res = defaultFuncs && defaultFuncs.get
                    ? await defaultFuncs.get(url, ctx.jar, {})
                    : await get(url, ctx.jar, null, ctx.globalOptions, ctx);

                const status = res && res.statusCode;
                const body = res && res.body ? res.body.toString() : '';

                if (status >= 300 && status < 400) {
                    throw new CustomError({ message: 'Login redirect detected', type: 'login_redirect', statusCode: status });
                }
                if (status === 0 || status === undefined) {
                    throw new CustomError({ message: 'No status code (network?)', type: 'network_error' });
                }
                if (status === 401 || status === 403) {
                    throw new CustomError({ message: 'Unauthorized / forbidden', type: 'not_logged_in', statusCode: status });
                }
                if (isHtmlLoginPage(body)) {
                    throw new CustomError({ message: 'HTML login page served', type: 'html_login_page' });
                }
                // Basic heuristic: body containing checkpoint indicators
                if (/checkpoint|review recent login/i.test(body)) {
                    throw new CustomError({ message: 'Checkpoint required', type: 'checkpoint' });
                }
            } catch (err) {
                allPassed = false;
                if (attempt >= retries) {
                    // Re-throw final classified error (ensure type present)
                    if (err instanceof CustomError) throw err;
                    throw new CustomError({ message: err.message || 'Session invalid', type: err.type || 'not_logged_in', original: err });
                }
                break; // break inner loop to retry endpoints
            }
        }
        if (allPassed) return true;
        if (attempt < retries) await delay(delayMs);
    }
    // Fallback (should not reach)
    throw new CustomError({ message: 'Unknown session validation failure', type: 'not_logged_in' });
}

// --- Advanced Feature: Dynamic DocID Fetching ---
async function getLatestDocIDs(api) {
    // This is a placeholder for a future feature that dynamically fetches
    // the latest GraphQL DocIDs from Facebook's source code.
    // For now, it returns the known stable IDs.
    return {
        "getThreadList": "8805201422847259",
        "getThreadInfo": "8805201422847259", // Updated 2025
        "sendMessage": "8805201422847259"
    };
}

// Preserve earlier named exports while adding validateSession
module.exports = {
    CustomError,
    cleanHTML,
    isReadableStream: isReadableStream,
    get: get,
    get2: get2,
    post: post,
    postFormData: postFormData,
    generateThreadingID: generateThreadingID,
    generateOfflineThreadingID: generateOfflineThreadingID,
    getGUID: getGUID,
    getFrom: getFrom,
    makeParsable: makeParsable,
    arrToForm: arrToForm,
    getSignatureID: getSignatureID,
    getJar: getJar,
    generateTimestampRelative: generateTimestampRelative,
    makeDefaults: makeDefaults,
    parseAndCheckLogin: parseAndCheckLogin,
    getData_Path,
    setData_Path,
    getPaths,
    saveCookies,
    saveAppState,
    getAppState,
    sanitizeCookieJar,
    normalizeCookieExpiry,
    isSafeAppState,
    getAppStateB64: function () {
        if (process.env.NEXUS_APPSTATE_B64) {
            try { return JSON.parse(Buffer.from(process.env.NEXUS_APPSTATE_B64, 'base64').toString('utf8')); }
            catch (e) { log.error("utils", "Failed to parse NEXUS_APPSTATE_B64"); return null; }
        }
        return null;
    },
    getType,
    getHeaders,
    hintsForUA,
    _formatAttachment,
    formatHistoryMessage,
    formatID,
    formatMessage,
    formatDeltaEvent,
    formatDeltaMessage,
    formatMentions,
    parseMetadataMentions,
    unwrapMentionScalar,
    normalizeMentionID,
    parseMentionData,
    formatProxyPresence,
    formatPresence,
    formatTyp,
    formatDeltaReadReceipt,
    formatCookie,
    formatThread,
    formatReadReceipt,
    formatRead,
    generatePresence,
    generateClientID,
    formatDate,
    decodeClientPayload,
    getAppState,
    getAdminTextMessageType,
    setProxy,
    checkLiveCookie,
    getFroms,
    validateSession,
    // Safety & rate limiting exports
    rateLimiter,
    smartSafetyLimiter,
    safeMode,
    ultraSafeMode,
    isUserAllowed,
    getLatestDocIDs,
    randomUserAgent
};