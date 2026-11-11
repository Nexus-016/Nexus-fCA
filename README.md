<p align="center">
  <img src="https://i.ibb.co/Sk61FGg/Dragon-Fruit-1.jpg" alt="Nexus-FCA" width="520" />
</p>

# Nexus-FCA v4.4.0 🛡️🚀

> **Advanced, Hardened & Massive-Load-Ready Facebook Messenger API**
> *UA Fingerprint Lock • Anti-Lock Session Guard • MQTT v5 • E2EE Bridge • Zero Detection Focus*

---

## 🆕 New in v4.4.0 (Production Hardening + Deps Modernization)

### 🧬 UA Fingerprint Lock (session-long identity)
- **One stable Chrome/141 UA per session** — login, HTTP headers, MQTT connect and cookie checks all share the *same* fingerprint (no more UA drift between subsystems, which is a classic detection trigger).
- Seeded from `globalOptions.userAgent` → persisted in `Fca_Database/safety_store.json`; stale-version UAs are rejected on load and re-locked.
- Platform hints (`Sec-Ch-Ua`, `Sec-Ch-Ua-Platform`) are always consistent with the locked UA — Windows UA never claims Linux again.
- Opt-outs: `{ fingerprintLock: false }` (old rotation behavior), or `{ randomUserAgent: true }` for deliberate per-request rotation.

### 🔐 Login-Time Dead-Cookie Detection + Anti-Lock Guard
- Expired/invalid cookies are **caught at login time**, before MQTT even starts — typed lock patterns:
  `checkpoint`, `unusual_activity`, `account_locked`, `temporarily_blocked`, `verification_required`, `login_approval`, `cookie_invalid`
- Patient retry backoff **15 → 30 → 60 min** (cap 60) that **re-reads `appstate.json`** on every attempt — so once you fix the cookie file, the next retry picks it up automatically.
- **Never hot-exits on lock errors** — no crash loops on ephemeral hosts (Koyeb/Render/Heroku-friendly).

### 🔄 CookieRefresher Actually Runs Now
- `appStatePath` fully wired → the refresher can persist refreshed cookies back to disk.
- First refresh is **delayed 2–4 minutes** after login (no burst right after connect).
- `sessionGuard` skips unchanged state (no pointless writes), `getAppState` dedupes duplicate cookies.
- `NEXUS_COOKIE_BACKUP_PATH` / `backupPath` support for automatic cookie backups.

### 📦 Massive-Load Protections (many groups / high message rate)
| Protection | Behavior |
|------------|----------|
| **Per-thread group queue** | cap 100, 3 parallel sends, idle timeout 30 min, 5-min sweeper |
| **Deadlock-proof queue** | sync throws can no longer strand `activeSends` — a thread can never be permanently silenced |
| **`_pendingOutbound` TTL sweep** | 3-min TTL + 1000-entry cap (no unbounded memory) |
| **Circuit breaker** | 5 consecutive failures → 5-min cooldown, wired through the real callback path |
| **`smartSafetyLimiter` pruning** | per-user sessions pruned after 1h idle / 5-min gate |
| **Bounded metrics** | ack-latency samples capped at 50, editSettings `maxPendingEdits` capped 200 |
| **sqlite WAL everywhere** | `WAL` + `busy_timeout 5000` on every database, 24h metrics retention |

### ⬆️ Dependencies Modernized
| Package | Before | Now |
|---------|--------|-----|
| mqtt | 4.3.8 (2021-era) | **5.16.1** — live-tested with our exact `MQIsdp/3` + custom `wsOptions` headers over WebSocket |
| uuid | 9.x | **11.1.x** (last major with `require()` support) |
| ws | 8.19 | **8.22.2** |
| cheerio | rc pins | **1.2.0 stable** |
| axios / tough-cookie / jar-support | mixed | **current, aligned 5.x pair** |

`engines: node >= 20`.

### 🔇 Noise Control
- Per-send MQTT payload dumps are gated behind `NEXUS_VERBOSE_MQTT=1` — clean logs in production.

---

## 🆕 New in v4.3.x (Feature Wave)

- **E2EE Bridge (opt-in, BETA)** — `api.connectE2EE(cb)`, `api.getE2EEBridge()`, `api.getE2EEDeviceData(cb)`. Reactions/typing E2EE routes included (guarded, fall through when off). Enable with `{ enableE2EE: true }` + `npm i koffi yumi-json-bigint` + Labyrinth native binary. See E2EE section below.
- **storyManager** — `api.storyManager({ action: 'add' | 'upload' | 'delete' | 'check', attachment, storyID })`.
- **stickerStore** — `api.stickerStore.{ search, listPacks, getStorePacks, listAllPacks, addPack, getStickersInPack, getAiStickers }`.
- **OldMessage fallback** — `api.OldMessage(msg, threadID)`: legacy HTTP `messaging/send/` path when MQTT send fails.
- **createThemeAI** — AI-generated chat themes (up to 10 themes, returns `allThemes`), endpoint fixed for `field_exception 1675030`.
- **sendButtons / sendFriendRequest / setActiveStatus / setProfileLock / setStorySeen** — more real API surface.
- **autoLogin module** — self-healing login subsystem: `autoLogin`, `autoSave`, `safeMode`, `maxRetries`, `retryDelay`, `persistentDevice` (device fingerprint persistence), `appstatePath` / `credentialsPath` / `backupPath`.
- **Theme APIs** — `getThreadTheme`, `setThreadTheme`, `getThemePictures`, `generateAndSetTheme`, `changeAvatarV2`, `enableAutoSaveAppState`, `scheduler`, `note`, `searchFriends`.
- **user-agents.js** — curated modern UA pool (Windows/mac/Linux, Chrome 141) with consistent platform hints.

---

## ✅ Core Value

| Pillar | What You Get |
|--------|--------------|
| **🧬 One Identity per Session** | UA fingerprint lock across login/HTTP/MQTT/cookie-check |
| **🔐 Anti-Lock Guard** | Login-time dead-cookie detection, typed lock errors, patient retry backoff |
| **📦 Massive-Load Ready** | Per-thread queues, circuit breaker, TTL sweeps, bounded memory everywhere |
| Integrated Secure Login | Email/Password/TOTP-2FA → stable appstate generation & reuse |
| Session Resilience | Anchored UA continuity, adaptive safe refresh, lightweight token poke, periodic recycle |
| Connection Stability | Adaptive MQTT backoff (v5), idle & ghost detection, layered post-refresh health probes |
| Delivery Reliability | Multi-path fallback (MQTT → HTTP → direct → OldMessage) + receipt timeout suppression |
| Memory Guard | Bounded queues, edit TTL sweeps, controlled resend limits, 24h metrics retention |
| Observability | `api.getHealthMetrics()`, `api.getMemoryMetrics()` |
| Type Definitions | First-class `index.d.ts` |

---

## 🚀 Quick Start

```bash
npm install nexus-fca
```

### Option 1: AppState (Cookie) Login — Recommended
```js
const login = require('nexus-fca');

(async () => {
  const api = await login({ appState: require('./appstate.json') }, {
    autoReconnect: true
    // fingerprintLock is ON by default — one stable UA for the whole session
  });
  console.log('Logged in as', api.getCurrentUserID());
  api.listen((err, evt) => {
    if (err) return console.error('Listen error:', err);
    if (evt.body) api.sendMessage('Echo: ' + evt.body, evt.threadID);
  });
})();
```

### Option 2: Email / Password (+ optional 2FA)
```js
const login = require('nexus-fca');

(async () => {
  const api = await login({
    email: 'your-email@example.com',
    password: 'your-password'
  }, { autoReconnect: true });
  console.log('✅ Logged in!');
  api.listen((err, msg) => {
    if (err) return console.error(err);
    if (msg.body === 'ping') api.sendMessage('pong', msg.threadID);
  });
})();
```

### Option 3: Self-Healing AutoLogin (appstate + credentials on disk)
```js
const login = require('nexus-fca');

(async () => {
  const api = await login({ appState: require('./appstate.json') }, {
    appStatePath: './appstate.json',      // refresher writes back here
    credentialsPath: './credentials.json', // email/password for re-login
    backupPath: './backups',               // cookie backups
    autoLogin: true,                       // re-login when cookies die
    autoSave: true,
    safeMode: true
  });
  api.listen((err, evt) => { /* ... */ });
})();
```

---

## ⚙️ Login Options Reference

| Option | Default | What it does |
|--------|---------|--------------|
| `appState` | – | Cookie array (from `appstate.json`) — most stable path |
| `email` / `password` | – | Credential login (generates appstate) |
| `userAgent` | safe Chrome/141 | Explicit UA; becomes the session-locked fingerprint |
| `fingerprintLock` | `true` | One stable UA per session. `false` = legacy rotation |
| `randomUserAgent` | `false` | Deliberate per-request UA rotation (opt-in) |
| `appStatePath` | auto | Where cookies are persisted (env `NEXUS_APPSTATE_PATH`) |
| `credentialsPath` | auto | Where email/password are stored (env `NEXUS_CREDENTIALS_PATH`) |
| `backupPath` | auto | Cookie backup dir (env `NEXUS_BACKUP_PATH`) |
| `autoLogin` | `true` | Self-healing re-login when cookies die |
| `autoSave` | `true` | Save credentials on first login |
| `safeMode` | `true` | Conservative safety defaults |
| `persistentDevice` | `true` | Device fingerprint persistence (`persistent-device.json`) |
| `enableE2EE` | `false` | Opt-in E2EE bridge (BETA, needs native deps) |
| `enableSafeDelays` | `true` | Human-like delays to reduce detection |
| `autoReconnect` | `true` | Auto reconnect on drop |
| `listenEvents` | `false` | Also emit non-message events |
| `forceLogin` | `false` | Force a fresh login instead of appstate reuse |
| `autoMarkRead` / `updatePresence` | `false` | Read receipts / presence |
| `emitReady` | `false` | Emit a `ready` event after connect |
| `bypassRegion` | – | Force region (`PRN` etc., env `NEXUS_BYPASS_REGION`) |
| `proxy` | – | `http://` / `socks5://` proxy |
| `pageID` | – | Operate as a Facebook Page |
| `mqttMaxReconnectAttempts` | `Infinity` | Cap reconnect attempts if you want (default: never give up) |
| `sessionGuard` | `true` | Skip-unchanged session writes |
| `antiLogout` / `facebookProtection` / `humanLikeDelay` | `true` | Protection opt-outs |
| `logLevel` / `pauseLog` / `logRecordSize` | – | Logging control |

**Environment variables:** `NEXUS_VERBOSE_MQTT=1` (verbose MQTT payload logs), `NEXUS_APPSTATE_PATH`, `NEXUS_CREDENTIALS_PATH`, `NEXUS_BACKUP_PATH`, `NEXUS_COOKIE_BACKUP_PATH`, `NEXUS_DEVICE_FILE`, `NEXUS_RANDOM_USER_AGENT=true`, `NEXUS_BYPASS_REGION`.

---

## ⚡ Speed vs Safety — Your Choice

```js
// MAXIMUM SPEED — bypass queue
api.setFastSend(true);

// BALANCED (default) — 3 concurrent sends
api.setParallelSend(3);

// MORE SPEED — up to 5 concurrent
api.setParallelSend(5);

// MAXIMUM SAFETY — sequential queue
api.setParallelSend(1);
api.setFastSend(false);
```

Per-thread queue capacity:
```js
api.enableGroupQueue(true);
api.setGroupQueueCapacity(100);   // default 100 per thread, 3 parallel
```

---

## 🔐 Anti-Lock Behavior (What Happens When Cookies Die)

```
login → dead cookies detected (typed pattern)
      → lock info exposed, NO process.exit
      → retry in 15 min → re-read appstate.json
      → still dead → 30 min → 60 min (cap) → keep re-reading
      → you replace appstate.json → next retry logs in fresh
```
This is designed for ephemeral hosts: **the process stays alive and self-recovers** as soon as you drop a fresh cookie file in — no restart needed.

---

## 🧪 Key Runtime APIs

```js
api.setEditOptions({ maxPendingEdits, editTTLms, ackTimeoutMs, maxResendAttempts });
api.setBackoffOptions({ base, factor, max, jitter });
api.enableLazyPreflight(true);        // Skip heavy validation if recent success
api.getHealthMetrics();               // uptime, reconnects, ack latency, delivery stats
api.getMemoryMetrics();               // queue sizes & guard counters
api.getAppState();                    // current cookie state (deduped)
api.OldMessage(msg, threadID);        // legacy HTTP send fallback
api.connectE2EE(cb);                  // opt-in E2EE bridge (BETA)
```

### Monitoring Snippet
```js
setInterval(() => {
  const h = api.getHealthMetrics();
  const m = api.getMemoryMetrics();
  console.log('[HEALTH]', h?.status, 'acks', h?.ackCount, 'p95Ack', h?.p95AckLatencyMs);
  console.log('[DELIVERY]', {
    attempts: h?.deliveryAttempts,
    success: h?.deliverySuccess,
    failed: h?.deliveryFailed,
    timeouts: h?.deliveryTimeouts
  });
  console.log('[MEM]', m);
}, 60000);
```

---

## 🛡️ Safety & Stability Architecture

| Layer | Mechanism | Purpose |
|-------|-----------|---------|
| UA Fingerprint Lock | One Chrome/141 identity per session | Consistent fingerprint across all subsystems |
| Login Guard | Typed lock-pattern detection at login | Catch dead cookies/checkpoints before MQTT |
| Retry Backoff | 15→30→60 min, re-reads cookie file | Self-recovery without restart |
| Adaptive Refresh | Risk-aware timing bands, 2–4 min initial delay | Token longevity without bursts |
| Lightweight Poke | Subtle `fb_dtsg` renewal | Keeps session warm quietly |
| Collision Guard | 45m spacing window | Prevent clustered maintenance events |
| Idle / Ghost Probe | Timed silent detection | Force reconnect on stale sockets |
| Periodic Recycle | Randomized (~6h ±30m) | Pre-empt silent degradation |
| Backoff Strategy | Exponential + jitter | Graceful network recovery |
| Circuit Breaker | 5 fails → 5-min cooldown | Protects against failure storms |
| Delivery Suppression | Disable receipts after repeated timeouts | Preserve send latency |

Disable heavy preflight if embedding inside a framework that already checks:
```js
await login({ appState }, { disablePreflight: true });
```

---

## 🛰️ MQTT (v5) Enhancements
- Runs on **mqtt 5.16.1** with Facebook's exact `MQIsdp/3` protocol + custom `wsOptions` headers (live-verified).
- Smart recovery: fetches fresh Sequence ID before reconnecting on errors (no stale token loops).
- Proactive randomized reconnects (26–60m) to avoid long-session forced disconnects.
- Adaptive reconnect curve (cap 5 min), layered post-refresh probes (1s / 10s / 30s).
- Synthetic randomized keepalives (55–75s), structured error classification feeding metrics.
- Infinite reconnect by default (`mqttMaxReconnectAttempts` to cap).

---

## ✉️ Delivery Reliability
- Multi-path send fallback: **MQTT publish → HTTP send → direct → OldMessage (legacy `messaging/send/`)**.
- Per-attempt timeout & retry for delivery receipts.
- Automatic classification of transient timeouts (ETIMEDOUT / ECONNRESET / EAI_AGAIN).
- Adaptive suppression of receipt calls when the environment is unstable.

---

## 🔒 E2EE Bridge (Opt-in, BETA)

```js
const api = await login({ appState }, { enableE2EE: true });
// requires: npm i koffi yumi-json-bigint  (+ Labyrinth native binary)

api.connectE2EE((err, evt) => {
  if (err) return console.error(err);
  // encrypted events: e2eeMessage, e2eeMessageEdit, e2eeReaction, e2eeReceipt...
});
api.getE2EEBridge();     // direct bridge handle
api.getE2EEDeviceData(cb);
```
Reactions and typing indicators automatically use E2EE routes when enabled (guarded — fall through to normal routes when off). Status: **BETA** — needs a live secret-chat test.

---

## 🧠 Massive-Load / Long-Session Best Practices
1. Prefer appstate reuse — minimal credential logins (cookie-only is the most stable path).
2. Keep `appStatePath` set so the CookieRefresher can persist refreshes; keep `backupPath` for safety.
3. Never manually rotate the User-Agent — the fingerprint lock handles identity for the whole session.
4. Let the anti-lock backoff work — replace `appstate.json` and wait for the next retry; don't hot-restart.
5. Watch `getHealthMetrics()` before forcing reconnects; queue depth > 0 means work is flowing.
6. If you self-host many bot instances, give each its own data dir (`appStatePath`, `backupPath`).

---

## 🐐 Using with GoatBot V2 & Similar Bots (Summary)

| Goal | Steps |
|------|-------|
| Generate appstate | Credential login once → save `appstate.json` → configure bot |
| Full replacement | Install `nexus-fca` → shim `fb-chat-api/index.js` exporting this module |
| Direct require swap | `require('fb-chat-api')` → `require('nexus-fca')` |

```js
const login = require('nexus-fca');
(async () => {
  const api = await login({ appState: require('./appstate.json') });
  api.listen((err, event) => {
    if (err) return console.error(err);
    if (event.body === '!ping') api.sendMessage('pong', event.threadID);
  });
})();
```

---

## 📚 Documentation Map

| Resource | Location |
|----------|----------|
| Usage Guide (Examples) | `USAGE-GUIDE.md` |
| Full API Reference | `DOCS.md` |
| API Methods Reference | `API-METHODS-REFERENCE.md` |
| Feature Guides | `docs/*.md` |
| Configuration Reference | `docs/configuration-reference.md` |
| Account Safety Details | `docs/account-safety.md` |
| Cookie Management | `docs/cookie-management.md` |
| Deployment Config | `docs/deployment-config.md` |
| Maintenance Notes | `MAINTENANCE.md` |
| Hardening Notes | `PERSONAL-HARDENING.md`, `UPSTREAM-AUDIT.md` |
| Changelog | `CHANGELOG.md` |

---

## 🗺 Version History (Condensed)

| Version | Focus |
|---------|-------|
| **4.4.0** | Production hardening: UA fingerprint lock, login-time dead-cookie guard, CookieRefresher wiring, massive-load protections (group queue/circuit breaker/TTL sweeps), sqlite WAL, deps modernized (mqtt 5.16 / uuid 11 / ws 8.22) |
| 4.3.x | E2EE bridge (BETA), storyManager, stickerStore, OldMessage fallback, createThemeAI fix, autoLogin subsystem, theme/sticker/friend APIs |
| 4.2.0 | Safest round: ws3-fca/nkxfca patterns merged |
| 4.1.0 | Merged best of sahu/dongdev/toru/mostakim/nkxfca |
| 3.4.0 | Performance: parallel sending (1–5), fast send mode, queue control APIs |
| 3.0–3.2 | Delivery metrics, edit reliability, memory guard |
| 2.1.x | Safety consolidation, UA continuity, session longevity |

Full details in `CHANGELOG.md`.

---

## ⚠️ Disclaimer
Not affiliated with Facebook. Use responsibly and comply with platform terms & local laws.

---

## 🤝 Contributing
Focused PRs improving stability, safety heuristics, protocol coverage, or typings are welcome.

---

## 📜 License
[Team Nexus](https://www.facebook.com/profile.php?id=61572587854836)

MIT © 2025–2026 Nexus (Team Nexus)
