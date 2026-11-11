"use strict";
/* ═══════════════════════════════════════════════════════════════════════════
 *  alpha-fca/e2ee.js  —  Ultimate E2EE Bridge  (v1.0.0)
 *  Merged best-of-all from: hridoy-custom, ST-FCA, hridoy-akash
 *
 *  Sections:
 *    §0  Node.js < 22 undici webidl compatibility patch
 *    §1  Thread / JID detection helpers
 *    §2  Local media server (decrypted E2EE attachment cache)
 *    §3  E2EE Bridge (native Labyrinth client lifecycle)
 *    §4  API patch (helpers exposed on api object)
 * ═══════════════════════════════════════════════════════════════════════════
 */

var log    = require("npmlog");
var path   = require("path");
var urlMod = require("url");
var http   = require("http");
var crypto = require("crypto");
var fs     = require("fs");

// ─────────────────────────────────────────────────────────────────────────────
// §0  NODE.JS < 22 UNDICI COMPATIBILITY PATCH
//     undici v6+ calls webidl.util.markAsUncloneable() in its CacheStorage
//     constructor. That v8 binding was only introduced in Node.js v22.1.0.
//     On Node.js v18/v20 the call throws "not a function" and prevents the
//     E2EE ESM bundle (lib/index.mjs) from loading entirely.
//
//     Fix: pre-load undici's CJS webidl module and inject a no-op shim BEFORE
//     the ESM bundle imports undici. CJS modules are shared between the CJS
//     and ESM loaders (same Module._cache), so the ESM bundle picks up the
//     already-patched object automatically.
// ─────────────────────────────────────────────────────────────────────────────
;(function _patchUndiciWebidlForNode20() {
  try {
    var v8mod = require("v8");
    if (typeof v8mod.markAsUncloneable === "function") return; // Node 22+ — no patch needed

    // Resolve undici relative to this file's directory so we hit the right node_modules
    var searchPaths = [__dirname];
    try { searchPaths = searchPaths.concat(require.resolve.paths(__dirname) || []); } catch (_) {}

    var wPath = require.resolve("undici/lib/web/webidl", { paths: searchPaths });
    var webidl = require(wPath);

    if (webidl && webidl.util) {
      if (typeof webidl.util.markAsUncloneable !== "function") {
        webidl.util.markAsUncloneable = function() {};
        log.info("e2ee", "Applied undici webidl.markAsUncloneable patch for Node.js < 22");
      }
      if (typeof webidl.util.markAsUncloneableFast !== "function") {
        webidl.util.markAsUncloneableFast = function() {};
      }
    }
  } catch (patchErr) {
    // Non-fatal: undici may not be installed yet (first npm install), or Node 22+
    // where the patch is not needed.
  }
})();

// ─────────────────────────────────────────────────────────────────────────────
// §1  THREAD  —  detect E2EE JIDs (any string containing "@")
// ─────────────────────────────────────────────────────────────────────────────
function isE2EEChatJid(value) {
  return typeof value === "string" && value.indexOf("@") !== -1;
}

// ─────────────────────────────────────────────────────────────────────────────
// §2  MEDIA SERVER  —  local HTTP cache for decrypted E2EE attachments
// ─────────────────────────────────────────────────────────────────────────────
var _mediaCache  = new Map();
var _mediaServer = null;
var _mediaPort   = null;

function _cleanExpired() {
  var now = Date.now();
  _mediaCache.forEach(function(entry, id) {
    if (entry.expiry < now) _mediaCache.delete(id);
  });
}

function _startMediaServer() {
  if (_mediaServer && _mediaPort) return Promise.resolve(_mediaPort);
  return new Promise(function(resolve, reject) {
    var s = http.createServer(function(req, res) {
      var id    = req.url.replace(/^\/e2ee\//, "").split("?")[0];
      var entry = _mediaCache.get(id);
      if (!entry) { res.writeHead(404); return res.end("Not found"); }
      res.writeHead(200, {
        "Content-Type"  : entry.mimeType || "application/octet-stream",
        "Content-Length": entry.buffer.length,
        "Cache-Control" : "no-cache"
      });
      res.end(entry.buffer);
    });
    s.listen(0, "127.0.0.1", function() {
      _mediaPort   = s.address().port;
      _mediaServer = s;
      // Register exit handlers exactly once so the port is freed on shutdown
      if (!_mediaServer._exitRegistered) {
        _mediaServer._exitRegistered = true;
        function _closeMediaServer() {
          try {
            if (_mediaServer) { _mediaServer.close(); _mediaServer = null; _mediaPort = null; }
          } catch (_) {}
        }
        process.once("exit",    _closeMediaServer);
        process.once("SIGINT",  _closeMediaServer);
        process.once("SIGTERM", _closeMediaServer);
      }
      resolve(_mediaPort);
    });
    s.on("error", reject);
  });
}

async function storeMedia(buffer, mimeType) {
  var port = await _startMediaServer();
  _cleanExpired();
  var id = crypto.randomBytes(10).toString("hex");
  _mediaCache.set(id, {
    buffer  : buffer,
    mimeType: mimeType || "application/octet-stream",
    expiry  : Date.now() + 10 * 60 * 1000  // 10 minutes TTL
  });
  return "http://127.0.0.1:" + port + "/e2ee/" + id;
}

// ─────────────────────────────────────────────────────────────────────────────
// §3  BRIDGE  —  native Labyrinth E2EE client lifecycle
// ─────────────────────────────────────────────────────────────────────────────
var _dynamicImport = null;
function _getDynamicImport() {
  if (!_dynamicImport)
    _dynamicImport = new Function("specifier", "return import(specifier);");
  return _dynamicImport;
}

// ESM bundle + native binary are relative to this file's directory
var _E2EE_LIB_URL = urlMod.pathToFileURL(
  path.join(__dirname, "lib", "e2ee", "index.mjs")
).href;

// Polyfill File / Blob for Node < 20 before the ESM bundle initialises
;(function _polyfillFileGlobal() {
  try {
    if (typeof globalThis.File === "undefined") {
      var b = require("buffer");
      if (b && typeof b.File === "function") globalThis.File = b.File;
    }
    if (typeof globalThis.Blob === "undefined") {
      var b2 = require("buffer");
      if (b2 && typeof b2.Blob === "function") globalThis.Blob = b2.Blob;
    }
  } catch (_) {}
})();

// ── Size-capped Map insert ────────────────────────────────────────────────────
// Prevents unbounded memory growth on long-running bots.
var _E2EE_MAP_CAP = 2000;
function _cappedMapSet(map, key, value) {
  if (map.size >= _E2EE_MAP_CAP) {
    // Delete the oldest entry (Maps preserve insertion order)
    map.delete(map.keys().next().value);
  }
  map.set(String(key), String(value));
}

// ── Bridge internal helpers ───────────────────────────────────────────────────
function _isPromiseLike(v) { return v && typeof v.then === "function"; }

function _callUserCallback(cb, err, msg) {
  if (typeof cb !== "function") return;
  try {
    var r = cb(err, msg);
    if (_isPromiseLike(r)) r.catch(function(e) { log.error("e2ee", e); });
  } catch (e) { log.error("e2ee", e); }
}

function _parseMentions(arr, text) {
  var out = {};
  if (!Array.isArray(arr) || !text) return out;
  arr.forEach(function(m) {
    if (!m) return;
    var raw = m.userId != null ? m.userId
            : m.id != null ? m.id
            : m.uid != null ? m.uid
            : (m.entity && m.entity.id);
    if (raw == null) return;
    var id = String(raw)
      .replace(/^(?:fbid|uid|user|facebook|id)[:.]/i, "")
      .replace(/^@+/, "")
      .trim();
    var jid = id.match(/^([0-9]{5,}):[^@]*@/);
    if (jid) id = jid[1];
    if (!id) return;
    var o = Number(m.offset || 0), l = Number(m.length || 0);
    out[id] = text.substring(o, o + l);
  });
  return out;
}

function _normalizeAttType(t) {
  if (!t) return t;
  t = String(t).toLowerCase();
  if (t === "image")                return "photo";
  if (t === "document")             return "file";
  if (t === "voice" || t === "ptt") return "audio";
  return t;
}

function _normalizeAtt(a) {
  if (!a || typeof a !== "object") return a;
  return {
    type        : _normalizeAttType(a.type),
    ID          : a.stickerId != null ? String(a.stickerId) : undefined,
    url         : a.url, filename: a.fileName, mimeType: a.mimeType,
    fileSize    : a.fileSize != null ? String(a.fileSize) : undefined,
    width       : a.width, height: a.height, duration: a.duration,
    previewUrl  : a.previewUrl, description: a.description, source: a.sourceText,
    mediaKey    : a.mediaKey, mediaSha256: a.mediaSha256,
    mediaEncSha256: a.mediaEncSha256, directPath: a.directPath,
    latitude    : a.latitude, longitude: a.longitude, isE2EE: true
  };
}

// Extract the numeric prefix from an E2EE JID like "61568577897207:69@msgr" → "61568577897207"
// Returns "" when the JID has no numeric prefix (e.g. "@msgr", "@group.facebook.com").
function _numericId(jid) {
  if (!jid) return "";
  var s = String(jid);
  var m = s.match(/^(\d+)/);
  return m ? m[1] : "";
}

function _mapMsg(ev) {
  var text = ev && ev.text ? String(ev.text) : "";
  var sid  = ev && ev.senderId != null ? _numericId(String(ev.senderId)) : "";
  var tid  = ev && ev.chatJid  ? String(ev.chatJid)
           : (ev && ev.threadId != null ? String(ev.threadId) : "");

  var messageReply = null;
  if (ev && ev.replyTo) {
    var _rtId = ev.replyTo.messageId != null ? ev.replyTo.messageId
              : ev.replyTo.id != null ? ev.replyTo.id : undefined;
    // senderId can arrive as an empty protobuf object {} — treat that as unknown
    var _rtSender = (ev.replyTo.senderId != null &&
                     typeof ev.replyTo.senderId !== "object")
                  ? _numericId(String(ev.replyTo.senderId)) : "";
    messageReply = {
      type       : "message",
      threadID   : tid,
      messageID  : _rtId != null ? String(_rtId) : undefined,
      senderID   : _rtSender,
      body       : ev.replyTo.text != null ? String(ev.replyTo.text) : "",
      attachments: [],
      mentions   : {},
      isE2EE     : true
    };
  }

  return {
    // Use the standard FCA/GoatBot message type so existing command/event
    // handlers receive E2EE DM and group messages without a separate adapter.
    type       : "message",
    e2eeType   : "e2ee_message",
    senderID   : sid,
    body       : text,
    threadID   : tid,
    messageID  : ev.id != null ? String(ev.id) : ev.id,
    messageReply: messageReply,
    attachments: Array.isArray(ev.attachments) ? ev.attachments.map(_normalizeAtt) : [],
    mentions   : _parseMentions(ev.mentions, text),
    timestamp  : ev.timestampMs != null ? Number(ev.timestampMs) : Date.now(),
    isGroup    : /@group\.facebook\.com$/i.test(ev.chatJid || ""),
    isE2EE     : true,
    e2ee       : {
      chatJid    : ev.chatJid,
      senderJid  : ev.senderJid,
      replyTo    : ev.replyTo || null,
      rawMentions: ev.mentions || []
    },
    args: text.trim() ? text.trim().split(/\s+/) : []
  };
}

function _mapEdit(ev) {
  var text = ev && ev.text ? String(ev.text) : "";
  return {
    type     : "e2ee_message_edit",
    senderID : ev && ev.senderId != null ? String(ev.senderId) : "",
    body     : text,
    threadID : ev && ev.chatJid ? String(ev.chatJid) : "",
    messageID: ev ? ev.messageId : undefined,
    timestamp: ev && ev.timestampMs != null ? Number(ev.timestampMs) : Date.now(),
    isGroup  : /@group\.facebook\.com$/i.test(ev && ev.chatJid ? ev.chatJid : ""),
    isE2EE   : true,
    e2ee     : { chatJid: ev ? ev.chatJid : undefined, senderJid: ev ? ev.senderJid : undefined },
    args     : text.trim() ? text.trim().split(/\s+/) : []
  };
}

function _mapReaction(ev) {
  return {
    type     : "e2ee_message_reaction",
    threadID : ev && ev.chatJid ? String(ev.chatJid) : "",
    messageID: ev ? ev.messageId : undefined,
    reaction : ev ? ev.reaction : undefined,
    senderID : ev && ev.senderId != null ? String(ev.senderId) : undefined,
    userID   : ev && ev.senderId != null ? String(ev.senderId) : undefined,
    isE2EE   : true,
    e2ee     : { chatJid: ev ? ev.chatJid : undefined, senderJid: ev ? ev.senderJid : undefined }
  };
}

function _mapReceipt(ev) {
  return {
    type  : "e2ee_receipt",
    isE2EE: true,
    e2ee  : {
      receiptType: ev ? ev.type : undefined,
      chatJid    : ev ? ev.chat : undefined,
      senderJid  : ev ? ev.sender : undefined,
      messageIds : ev ? ev.messageIds : []
    }
  };
}

/**
 * Collect cookies from all relevant FB/Messenger domains.
 * i_user is the page-scoped UID; treat it as c_user when c_user is missing.
 * Always sets c_user from ctx.userID as a final fallback.
 */
function _cookiesFromJar(ctx) {
  var out = {};
  var domains = [
    "https://www.facebook.com",
    "https://facebook.com",
    "https://www.messenger.com",
    "https://messenger.com"
  ];
  domains.forEach(function(d) {
    try {
      var cks = ctx.jar.getCookies(d);
      if (Array.isArray(cks)) {
        cks.forEach(function(c) {
          if (c && c.key && !(c.key in out)) out[c.key] = c.value;
        });
      }
    } catch (_) {}
  });
  if (!out.c_user && out.i_user) out.c_user = out.i_user;
  if (!out.c_user && ctx && ctx.userID) out.c_user = String(ctx.userID);
  return out;
}

function _normalizeMediaInput(input) {
  if (Buffer.isBuffer(input)) return input;
  if (Array.isArray(input))   return Buffer.from(input);
  if (input && input.type === "Buffer" && Array.isArray(input.data)) return Buffer.from(input.data);
  if (typeof input === "string") return Buffer.from(input, "base64");
  throw new Error("E2EE media data must be Buffer, byte array, Buffer-JSON, or base64 string");
}

// ── createBridge ──────────────────────────────────────────────────────────────
function createBridge(ctx) {
  // Return cached bridge instance if already created for this ctx
  if (ctx._e2eeBridge) return ctx._e2eeBridge;

  var state = {
    client          : null,
    connected       : false,
    connectingPromise: null,
    listenerAttached: false,
    lastGlobalCallback: null,
    lastReadyPayload: null,
    fullyReady      : false,
    stopped         : false   // set by disconnect() to prevent reconnect loops
  };

  function _ensureEnabled() {
    if (ctx.globalOptions.enableE2EE === false)
      throw new Error("E2EE is disabled. Set enableE2EE:true in options or config.json.");
  }

  async function _loadClient() {
    var mod;
    try { mod = await _getDynamicImport()(_E2EE_LIB_URL); }
    catch (err) {
      throw new Error("Cannot load E2EE bundle (" + _E2EE_LIB_URL + "): " +
        (err && err.message ? err.message : String(err)));
    }
    if (!mod || !mod.Client)
      throw new Error("E2EE bundle loaded but Client export not found");
    return mod.Client;
  }

  function _attachEvents(initCb) {
    if (!state.client || state.listenerAttached) return;
    state.listenerAttached = true;
    if (typeof initCb === "function") state.lastGlobalCallback = initCb;

    state.client.on("ready", function(p) {
      state.lastReadyPayload = p;
      _callUserCallback(state.lastGlobalCallback, null, { type: "e2ee_ready", isE2EE: true, data: p || null });
    });
    state.client.on("fullyReady", function() {
      state.fullyReady = true;
      _callUserCallback(state.lastGlobalCallback, null, { type: "e2ee_fully_ready", isE2EE: true });
    });
    state.client.on("e2eeConnected", function() {
      _callUserCallback(state.lastGlobalCallback, null, { type: "e2ee_connected", isE2EE: true });
    });
    state.client.on("deviceDataChanged", function(p) {
      if (p && p.deviceData) ctx._e2eeDeviceData = p.deviceData;
      _callUserCallback(state.lastGlobalCallback, null, {
        type      : "e2ee_device_data_changed",
        isE2EE    : true,
        deviceData: p ? p.deviceData : undefined
      });
    });
    state.client.on("e2eeMessage", function(ev) {
      var mapped = _mapMsg(ev);

      // ── Self-listen filter ─────────────────────────────────────────────────
      // When selfListen is false (default), suppress messages the bot sent.
      // Guard 1: sendMessage records outgoing IDs in global._e2eeBotSentMsgIds.
      // Guard 2: UID-based cookie comparison as a fallback.
      if (!ctx.globalOptions.selfListen) {
        if (mapped.messageID &&
            global._e2eeBotSentMsgIds instanceof Set &&
            global._e2eeBotSentMsgIds.has(mapped.messageID)) {
          return;
        }
        // UID-based fallback filter via c_user / i_user cookie
        var _cookieUid = (function() {
          try {
            var _jar = ctx.jar.getCookies("https://www.facebook.com");
            for (var _ci = 0; _ci < _jar.length; _ci++) {
              var _ck = _jar[_ci];
              if (_ck.key === "c_user" || _ck.key === "i_user") return String(_ck.value);
            }
          } catch (_) {}
          return String(ctx.userID || "");
        })();
        if (_cookieUid && mapped.senderID && mapped.senderID === _cookieUid) return;
      }
      // ── End self-listen filter ─────────────────────────────────────────────

      global._e2eeMessageMap   = global._e2eeMessageMap   || new Map();
      global._e2eeSenderJidMap = global._e2eeSenderJidMap || new Map();

      if (mapped.messageID && mapped.threadID)
        _cappedMapSet(global._e2eeMessageMap, mapped.messageID, mapped.threadID);
      if (mapped.messageID && ev.senderJid)
        _cappedMapSet(global._e2eeSenderJidMap, mapped.messageID, ev.senderJid);

      // Register replyTo message IDs so unsend/react works on replied messages
      if (ev.replyTo && ev.chatJid) {
        var _rtReg = ev.replyTo.messageId || ev.replyTo.id;
        if (_rtReg) _cappedMapSet(global._e2eeMessageMap, _rtReg, ev.chatJid);
      }

      _callUserCallback(state.lastGlobalCallback, null, mapped);
    });

    state.client.on("e2eeMessageEdit", function(ev) {
      _callUserCallback(state.lastGlobalCallback, null, _mapEdit(ev));
    });
    state.client.on("e2eeReaction", function(ev) {
      _callUserCallback(state.lastGlobalCallback, null, _mapReaction(ev));
    });
    state.client.on("e2eeReceipt", function(ev) {
      _callUserCallback(state.lastGlobalCallback, null, _mapReceipt(ev));
    });

    state.client.on("error", function(err) {
      var msg = err && err.message ? err.message : String(err || "");
      // Transient network errors — the bridge will reconnect automatically
      if (/close 1006|unexpected EOF|ECONNRESET|ETIMEDOUT|read loop/i.test(msg)) {
        log.warn("e2ee", "Transient network error — bridge will reconnect: " + msg);
        return;
      }
      _callUserCallback(state.lastGlobalCallback, err || new Error("Unknown E2EE error"));
    });

    state.client.on("disconnected", function(info) {
      state.connected  = false;
      state.fullyReady = false;
      // Jittered reconnect delay: 3–4 seconds (avoids thundering-herd on restarts)
      var delay = 3000 + Math.floor(Math.random() * 1000);
      log.warn("e2ee", "E2EE disconnected — reconnecting in " + Math.round(delay / 1000) + "s");
      setTimeout(function() {
        if (!state.stopped && !state.connectingPromise) {
          var cb = (ctx && ctx._globalCallback) || state.lastGlobalCallback;
          if (typeof cb === "function") state.lastGlobalCallback = cb;
          connect(cb).catch(function(e) {
            log.error("e2ee", "E2EE reconnect failed: " + (e && e.message ? e.message : String(e)));
          });
        }
      }, delay);
      _callUserCallback(state.lastGlobalCallback, null, {
        type  : "e2ee_disconnected",
        isE2EE: true,
        data  : info || null
      });
    });
  }

  /**
   * Connect the E2EE bridge.
   * @param {Function} [globalCallback]  message handler (err, event)
   * @returns {Promise<Client>}
   */
  async function connect(globalCallback) {
    _ensureEnabled();
    state.stopped = false;
    if (typeof globalCallback === "function") state.lastGlobalCallback = globalCallback;
    if (state.connected && state.client) return state.client;
    if (state.connectingPromise) return state.connectingPromise;

    state.connectingPromise = (async function() {
      var Client = await _loadClient();
      if (!state.client) {
        var cookies = _cookiesFromJar(ctx);
        if (!cookies.c_user) {
          throw new Error("Cannot start E2EE: c_user cookie missing — is the bot logged in?");
        }
        if (!cookies.xs) {
          log.warn("e2ee", "xs cookie not found — E2EE bridge may fail if Facebook requires it");
        }

        var _logLevel      = (ctx.globalOptions && ctx.globalOptions.e2eeLogLevel) || "none";
        var _autoReconnect = (ctx.globalOptions && ctx.globalOptions.e2eeAutoReconnect !== false);

        var opts = {
          enableE2EE   : true,
          e2eeMemoryOnly: ctx.globalOptions.e2eeMemoryOnly !== false,
          autoReconnect: _autoReconnect,
          logLevel     : _logLevel
        };

        // Device key persistence (saveType: 'path')
        if (ctx.globalOptions.e2eeDevicePath) {
          opts.devicePath = path.resolve(String(ctx.globalOptions.e2eeDevicePath));
          try { fs.mkdirSync(path.dirname(opts.devicePath), { recursive: true }); } catch (_) {}
        }
        if (ctx.globalOptions.e2eeDeviceData) opts.deviceData = ctx.globalOptions.e2eeDeviceData;
        if (!opts.deviceData && global._pendingE2eeDeviceData) {
          opts.deviceData = global._pendingE2eeDeviceData;
          delete global._pendingE2eeDeviceData;
        }

        state.client = new Client(cookies, opts);
        _attachEvents(globalCallback);
      }
      await state.client.connect();
      state.connected  = true;
      state.fullyReady = false;
      return state.client;
    })();

    try   { return await state.connectingPromise; }
    finally { state.connectingPromise = null; }
  }

  /** Cleanly disconnect and prevent auto-reconnect. */
  async function disconnect() {
    state.stopped = true;
    if (!state.client) { state.connected = false; return; }
    try { await state.client.disconnect(); }
    finally {
      state.connected       = false;
      state.connectingPromise = null;
      state.listenerAttached  = false;
      state.client           = null;
    }
  }

  async function _ensureClient() {
    _ensureEnabled();
    if (state.connected && state.client) return state.client;
    return connect();
  }

  var bridge = {
    connect,
    disconnect,
    isConnected : function() { return !!(state.client && state.connected); },
    isFullyReady: function() {
      if (!state.client || !state.connected) return false;
      if (typeof state.client.isFullyReady === "function") {
        try { return !!state.client.isFullyReady(); } catch (_) {}
      }
      return !!state.fullyReady;
    },
    getState     : function() { return state; },
    getDeviceData: async function() { return (await _ensureClient()).getDeviceData(); },
    sendMessage  : async function(jid, text, opts) {
      return (await _ensureClient()).sendE2EEMessage(jid, text, opts || {});
    },
    sendReaction : async function(jid, msgId, senderJid, emoji) {
      return (await _ensureClient()).sendE2EEReaction(jid, msgId, senderJid, emoji);
    },
    sendTyping   : async function(jid, isTyping) {
      return (await _ensureClient()).sendE2EETyping(jid, isTyping !== false);
    },
    unsendMessage: async function(jid, msgId) {
      return (await _ensureClient()).unsendE2EEMessage(jid, msgId);
    },
    editMessage  : async function(jid, msgId, text) {
      return (await _ensureClient()).editE2EEMessage(jid, msgId, text);
    },
    downloadMedia: async function(opts) {
      var client = await _ensureClient();
      var size   = opts.fileSize != null ? Number(opts.fileSize) : undefined;
      var res = await client.downloadE2EEMedia({
        directPath  : opts.directPath,
        mediaKey    : opts.mediaKey,
        mediaSha256 : opts.mediaSha256,
        mediaEncSha256: opts.mediaEncSha256,
        mediaType   : opts.mediaType,
        mimeType    : opts.mimeType,
        fileSize    : size
      });
      return { data: res.data, mimeType: res.mimeType, fileSize: Number(res.fileSize) };
    },
    sendMedia: async function(jid, mediaType, data, opts) {
      var client = await _ensureClient();
      var buf    = _normalizeMediaInput(data);
      var o      = opts || {};
      var ntype  = String(mediaType || "").toLowerCase();
      switch (ntype) {
        case "image":
          return client.sendE2EEImage(jid, buf, o.mimeType || "image/jpeg", {
            caption: o.caption || "", width: o.width, height: o.height,
            replyToId: o.replyToId, replyToSenderJid: o.replyToSenderJid
          });
        case "video":
          return client.sendE2EEVideo(jid, buf, o.mimeType || "video/mp4", {
            caption: o.caption || "", duration: o.duration, width: o.width, height: o.height,
            replyToId: o.replyToId, replyToSenderJid: o.replyToSenderJid
          });
        case "audio":
        case "voice": {
          var mime    = o.mimeType || "audio/ogg; codecs=opus";
          var isVoice = ntype === "voice" || !!o.ptt;
          return client.sendE2EEAudio(jid, buf, mime, {
            ptt: isVoice,
            duration: o.duration != null ? Number(o.duration) : undefined,
            replyToId: o.replyToId, replyToSenderJid: o.replyToSenderJid
          });
        }
        case "file":
        case "document":
          return client.sendE2EEDocument(jid, buf, o.filename || "file.bin",
            o.mimeType || "application/octet-stream", {
              replyToId: o.replyToId, replyToSenderJid: o.replyToSenderJid
            });
        case "sticker":
          return client.sendE2EESticker(jid, buf, o.mimeType || "image/webp", {
            replyToId: o.replyToId, replyToSenderJid: o.replyToSenderJid
          });
        default:
          throw new Error("Unsupported E2EE mediaType: " + ntype);
      }
    }
  };

  ctx._e2eeBridge = bridge;
  return bridge;
}

// ─────────────────────────────────────────────────────────────────────────────
// §4  PATCH API  —  shared E2EE helpers exposed on the api object
// ─────────────────────────────────────────────────────────────────────────────
global._e2eeMessageMap   = global._e2eeMessageMap   || new Map();
global._e2eeSenderJidMap = global._e2eeSenderJidMap || new Map();

function _regMsg(msgID, jid) {
  if (msgID && jid) _cappedMapSet(global._e2eeMessageMap, msgID, jid);
}

/**
 * patchApiForE2EE — call once after buildAPI() when E2EE is enabled.
 * Adds: api.downloadE2EEMedia, api.resolveE2EEAttachment, api.sendTypingE2EE
 */
function patchApiForE2EE(api, ctx) {
  if (typeof api.downloadE2EEMedia !== "function") {
    api.downloadE2EEMedia = function(options) {
      return createBridge(ctx).downloadMedia(options);
    };
  }

  if (typeof api.resolveE2EEAttachment !== "function") {
    api.resolveE2EEAttachment = async function(att) {
      if (!att || !att.isE2EE) return att;
      if (att.url && /^https?:\/\//.test(att.url)) return att;
      if (!att.directPath || !att.mediaKey || !att.mediaSha256 || !att.mimeType) return att;
      try {
        var rawType = att.type === "photo" ? "image" : (att.type || "image");
        var res = await api.downloadE2EEMedia({
          directPath    : att.directPath,
          mediaKey      : att.mediaKey,
          mediaSha256   : att.mediaSha256,
          mediaEncSha256: att.mediaEncSha256 || undefined,
          mediaType     : rawType,
          mimeType      : att.mimeType,
          fileSize      : Number(att.fileSize)
        });
        var localUrl = await storeMedia(res.data, res.mimeType || att.mimeType || "image/jpeg");
        return Object.assign({}, att, { url: localUrl });
      } catch (e) {
        log.error("E2EE", "resolveE2EEAttachment failed: " + (e && e.message ? e.message : String(e)));
        return att;
      }
    };
  }

  if (typeof api.sendTypingE2EE !== "function") {
    api.sendTypingE2EE = function(chatJid, isTyping) {
      if (!isE2EEChatJid(chatJid)) return Promise.resolve();
      return createBridge(ctx).sendTyping(chatJid, isTyping !== false).catch(function() {});
    };
  }
}

module.exports = {
  isE2EEChatJid,
  storeMedia,
  createBridge,
  patchApiForE2EE,
  _cappedMapSet,   // exposed for sendMessage.js internal use
  _regMsg          // exposed for sendMessage.js to register outgoing E2EE message IDs
};
