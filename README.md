<p align="center">
  <img src="https://i.ibb.co/Sk61FGg/Dragon-Fruit-1.jpg" alt="Nexus-FCA" width="480" />
</p>

# Nexus-FCA v5.2.4 — GOAT Update

[![npm version](https://img.shields.io/npm/v/nexus-fca)](https://www.npmjs.com/package/nexus-fca)
[![npm downloads](https://img.shields.io/npm/dm/nexus-fca)](https://www.npmjs.com/package/nexus-fca)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE-MIT)
[![GitHub](https://img.shields.io/badge/github-Nexus--016%2FNexus--fCA-blue)](https://github.com/Nexus-016/Nexus-fCA)

> Advanced, hardened, and massive-load-ready Facebook Messenger API for Node.js.
> Full GoatBot V2 compatibility, cookie jar integrity, session-file protection, UA fingerprint lock, anti-lock session guard, MQTT v5, delivery fallback chain, bounded-memory queue architecture.

---

## What's New in v5.2.1 (Session Vault — Cookie-Death Fix)

- **Your session stops dying on restart**: every refreshed cookie state is mirrored to a `NEXUS_SESSION_VAULT_URL` endpoint (jsonbin-style stores or any HTTP JSON endpoint), and the boot flow restores the freshest copy instead of the frozen `APPSTATE_JSON` secret — Facebook rotates `xs`/`fr` while the bot runs, which is what killed sessions on Koyeb.
- **Setup**: host a private JSON store (e.g. a private jsonbin bin), set `NEXUS_SESSION_VAULT_URL` (+ optional `NEXUS_SESSION_VAULT_TOKEN`), seed it once with a fresh cookie export, done — from then on the vault is the source of truth and restarts never replay dead cookies.
- **Smart failover**: if a cookie login fails, the bot fingerprints the exact copy that failed and alternates sources (vault vs bootstrap) on the retry loop instead of hammering the same dead session.

## What's New in v5.2.0 (Lightspeed-2 — Full App Surface)

- **Every messaging operation now prefers the Messenger-app task channel**: unsend, delete, nickname, group image, poll, thread emoji, add-participants and admin status all go through `/ls_req` tasks with the shapes the app uses.
- **`sendMessage` carries the full surface**: mentions (`mention_data`), locations (`location_data`) and attachments (`send_type 3` + fbids uploaded through the existing web upload, plus the app's read-watermark task) all go through LightSpeed now — the message you send is indistinguishable in shape from an app message.
- **Silent idempotent fallback**: a publish error, a task rejection or a missing ack (15 s) falls back to the exact previous web chain; every migrated op is idempotent so a fallback can never corrupt thread state. Explicit url share-cards, non-stream attachments and mentions without body text stay web by design.
- **Shared task engine**: one internal helper owns the envelope, ack routing, timeout and cleanup — the discipline is identical everywhere.

## What's New in v5.1.0 (Lightspeed Send)

- **Messages now go through the Messenger app's own channel**: when the listener is connected, `sendMessage` publishes the same LightSpeed task (`/ls_req`, `app_id 2220391788200892`, label `46`) the Messenger app uses — text, sticker and reply messages no longer touch the heavily scrutinized legacy `www.facebook.com/messaging/send/` POST.
- **Automatic web fallback**: attachments, URLs, locations, mentions, `sendViaMqtt: false`, a disconnected listener and a missing ack (15 s) all fall back to the proven web path — the old chain is fully preserved.
- **Tolerant ack extraction**: first-time DM / message-request threads ack through optimistic-message ops (`replaceOptimisticMessage` / `insertMessage` / `writeCTAIdToThreadsTable`); the extractor walks the step tree and is exported for tooling.
- **Why it matters**: every message sent through LightSpeed is one less hit on the legacy web send endpoint — the bot's traffic pattern looks like the Messenger app instead of a browser script hitting `messaging/send/`.

## What's New in v5.0.6 (Deep Audit)

- **Atomic appstate writes**: crash mid-write can no longer leave a truncated session file (write-to-temp + rename).
- **`refreshFb_dtsg` fixed**: `{ signal }` callers get a real refresh now (previously a fake success that polluted `ctx`); abort signals are honored and the callback settles exactly once.
- **Relogin hygiene**: the previous CookieRefresher is disposed on re-login so its stale timers can never overwrite the new session's cookies.

## What's New in v5.0.5 (Hidden-Issue Audit)

- **`api.getUID` fully local**: resolves profile links without any third-party service — ids in the link (`profile.php?id=`, numeric paths) return instantly, vanity links are fetched through the bot's own session and parsed locally. A login-page response is reported as a session problem.
- **Performance**: appstate auto-persist throttled to at most one disk write per 10 seconds (busy sessions used to write on every `Set-Cookie` response).
- **Stability**: CookieRefresher's retry timer no longer holds the process open.

## What's New in v5.0.4 (Advanced Parity — Local)

- **`login.utils.checkLiveCookie(input)`**: sessionless cookie liveness probe — accepts a cookie array, a raw cookie string, cookies.txt or a jar; returns `{ live, accountID, reason, checkedAt }`. Runs locally, nothing uploaded.
- **`api.getDeviceIdentifiers()`**: stable `{ deviceID, familyDeviceID, machineID }` persisted next to the account's appstate.
- **`api.setListenerOptions()` / `api.getListenerOptions()`**: live listener-option updates.

> Why this matters: other "advanced" FCAs ship a thin client that uploads your cookies to their server (`fca.neokex.xyz`) and runs every feature — even basic sends — remotely. Nexus-fCA keeps your session on your machine: cookies never leave it.

## What's New in v5.0.3 (Full GoatBot V2 Surface Audit)

Full surface audit — every upstream API method, every event type, every dev-user input shape:

- **appState input normalization (upstream parity)**: raw cookie strings (`"c_user=...; xs=...;"`), `{name, value}` cookie exports, JSON array strings and normal arrays are all accepted at every login entry point — the upstream main-framework FCA accepted all of these, ours threw "Failed to parse appState".
- **String IDs everywhere**: MQTT task-ack messageID/threadID/mid are stringified at emission and `sendMessage` coerces a numeric reply target instead of rejecting — no more type-mismatch issues in reply chains.

## What's New in v5.0.2 (Upstream Main-Framework Sync)

Synced the login chain with the upstream main GoatBot V2 framework (its final `1.5.35` "fix: fca not working" commit):

- **m_basic device-mode fix**: Facebook's "This browser is not supported" interstitial on datacenter IPs (Koyeb/Railway) is now followed via its embedded `gfid` device-switch link, restoring a parseable home page (fb_dtsg + MQTT endpoint/region) and a working listener.
- **MPageLoadClientMetrics UA fallback**: one iPhone-UA refetch when the home page lacks the region/seqID bootstrap marker; the pinned session UA is untouched.
- **Live interstitials are not dead sessions**: the login-time evidence check no longer declares the browser-not-supported page dead — real login forms and checkpoint markers remain the decisive signals.

## What's New in v5.0.1 (GoatBot Contract Hotfix)

Audited against the upstream GoatBot V2 framework and fixed three contract mismatches:

- **Relogin trigger restored**: the bot's listener callback matches the literal `error.error == "Not logged in."` to start its relogin/restart flow — Nexus's custom error messages failed that match, leaving the bot silent with a dead listener. Dead-session errors now emit the canonical string (raw detail kept in `message`).
- **`api.stopListening` added**: the bot calls it before every relogin; without it old MQTT connections survived and events were processed twice (duplicate replies).
- **mbasic SeqID fallback evidence-based**: the hidden bare-substring dead-check (`login` + `password` substrings present in logged-in pages too) no longer false-positives healthy sessions.

## What's New in v5.0.0 (GOAT Update)

**GoatBot V2 Full Compatibility**
- Every `api.*` method GoatBot V2 calls is verified present with matching semantics — messages, typing (v1/v2), thread info/list, user info, reactions, unsend, nickname/theme/emoji/color/image, group management, MQTT listener, appstate, dtsg refresh, and more. The audit runs as part of the test suite.
- Drop-in for the bot: `login({ appState }, callback)` — the bot keeps its own session files, and Nexus never writes an incomplete cookie set over a working one.

**Cookie Jar Integrity**
- Cookies that enter the jar (or whose expiry is extended by the refresher) always keep a valid `expires` type — a plain string could previously poison the whole jar and crash every request with `this.expires.getTime is not a function`.
- `sanitizeCookieJar` self-heals any cookie whose expiry lost its type, using the cookie store directly (safe even on an already-poisoned jar).

**Session-File Protection**
- Auto-savers (session guard, cookie refresher) refuse to persist a cookie set that lost the session core (`c_user`/`xs`) — a working appstate file is never overwritten with a broken one.

**Cleaner Failure Reporting**
- `uploadAttachment` no longer retries missing/inaccessible attachment files three times with full stack dumps; it fails fast with one actionable message. Transient network errors still retry.
- Module-style logging (`logger("Module", "message", "level")`) now prints module name and message together; `debug` output is gated behind `NEXUS_DEBUG=1`.

---

## What's New in v4.4.1

**Session stability hotfix** — three production-blocking session bugs fixed and verified against live Facebook traffic.

**Evidence-Based Login Validation**
- A session is proven alive by the account's `c_user`/`i_user` id appearing in the page bootstrap — not by substring guesses that logged-in pages also contain (escaped `login.php` URLs are part of every home page's prefetch config).
- A suspicious page is confirmed once against `home.php` before it is declared dead; checkpoint markers stay decisive.
- Fresh cookies log in reliably; corrupted cookies still route into the anti-lock guard with the typed lock patterns.

**MQTT Broker Compatibility**
- The edge-chat broker answers QoS-1 publishes with MQTT5-style PUBACK header bytes, which the standard parser rejects (`Invalid header flag bits, must be 0x0 for puback packet`) — ending the session right after queue creation.
- Incoming WebSocket frames are normalized in the stream bridge: non-compliant PUBACKs are rewritten in place (flags cleared, a present reason code stripped); compliant packets pass through untouched, zero-copy.
- QoS-1 sends stay stable mid-session: messages, reactions and mark-as-read all publish with QoS-1.

**Cookie Refresher Correctness**
- Refresh requests use the same request shape as login (a plain page GET) instead of an API-shaped request that Facebook answers with error 1357004 in a ~250-byte async wrapper.
- Success is detected by the account id in the page body, not by the presence of Set-Cookie headers — Facebook sends none while every cookie is still valid.
- Expiry extension and backups now actually run; healthy sessions no longer report "All refresh URLs failed".

**Diagnostics & Hygiene**
- A full login boot logs zero warnings (a known object-export module is skipped silently).
- `appStatePath` / `appstatePath` option spellings are both accepted end-to-end.

---

## What's New in v4.4.0

**UA Fingerprint Lock**
- One stable Chrome/141 identity per session. Login, HTTP headers, MQTT connect, and cookie checks all share the same fingerprint — UA drift between subsystems (a classic detection trigger) is eliminated.
- Persisted in `Fca_Database/safety_store.json`; stale-version UAs are rejected and re-locked on load.
- Client Hints (`Sec-Ch-Ua`, `Sec-Ch-Ua-Platform`) always stay consistent with the locked UA.
- Opt-outs: `{ fingerprintLock: false }` (legacy rotation) or `{ randomUserAgent: true }` (deliberate per-request rotation).

**Login-Time Dead-Cookie Detection + Anti-Lock Guard**
- Expired/invalid cookies are caught at login time, before MQTT starts, with typed lock patterns: `checkpoint`, `unusual_activity`, `account_locked`, `temporarily_blocked`, `verification_required`, `login_approval`, `cookie_invalid`.
- Patient retry backoff **15 → 30 → 60 min** (cap 60) that re-reads `appstate.json` on every attempt — replace the cookie file and the next retry picks it up automatically.
- Never hard-exits on lock errors. Designed for ephemeral hosts (Koyeb, Render, Heroku): the process stays alive and self-recovers.

**CookieRefresher Fully Wired**
- `appStatePath` wired end-to-end so refreshed cookies persist back to disk.
- First refresh delayed 2–4 minutes after login (no post-connect burst).
- `sessionGuard` skips unchanged state; `getAppState` dedupes duplicate cookies; `NEXUS_COOKIE_BACKUP_PATH` / `backupPath` support automatic backups.

**Massive-Load Protections**

| Protection | Behavior |
|------------|----------|
| Per-thread group queue | Cap 100, 3 parallel sends, idle timeout 30 min, 5-min sweeper |
| Deadlock-proof queue | Sync throws can no longer strand `activeSends` — a thread can never be permanently silenced |
| `_pendingOutbound` TTL sweep | 3-min TTL + 1000-entry cap |
| Circuit breaker | 5 consecutive failures → 5-min cooldown |
| `smartSafetyLimiter` pruning | Per-user sessions pruned after 1h idle |
| Bounded metrics | Ack-latency samples capped; `maxPendingEdits` capped at 200 |
| sqlite WAL everywhere | `WAL` + `busy_timeout 5000` on every database, 24h metrics retention |

**Dependencies Modernized**

| Package | Before | Now |
|---------|--------|-----|
| mqtt | 4.3.8 (2021-era) | **5.16.1** |
| uuid | 9.x | **11.1.x** |
| ws | 8.19 | **8.22.2** |
| cheerio | rc pins | **1.2.0 stable** |

Requires Node.js >= 20. Per-send MQTT payload dumps are now gated behind `NEXUS_VERBOSE_MQTT=1`.

---

## Core Value

| Pillar | What You Get |
|--------|--------------|
| One identity per session | UA fingerprint lock across login/HTTP/MQTT/cookie-check |
| Anti-lock guard | Login-time dead-cookie detection, typed lock errors, patient retry backoff |
| Massive-load ready | Per-thread queues, circuit breaker, TTL sweeps, bounded memory everywhere |
| Stable login | Email/Password/TOTP-2FA → appstate generation and reuse |
| Session resilience | Adaptive safe refresh, lightweight token poke, periodic recycle |
| Connection stability | Adaptive MQTT backoff (v5), idle and ghost detection, layered health probes |
| Delivery reliability | Multi-path fallback: MQTT → HTTP → direct → OldMessage |
| Observability | `api.getHealthMetrics()`, `api.getMemoryMetrics()` |
| Type definitions | First-class `index.d.ts` |

---

## Quick Start

```bash
npm install nexus-fca
```

**Option 1 — AppState (cookie) login (recommended)**

```js
const login = require('nexus-fca');

(async () => {
  const api = await login({ appState: require('./appstate.json') }, {
    autoReconnect: true
    // fingerprintLock is ON by default — one stable UA for the whole session
  });
  api.listen((err, evt) => {
    if (err) return console.error('Listen error:', err);
    if (evt.body) api.sendMessage('Echo: ' + evt.body, evt.threadID);
  });
})();
```

**Option 2 — Email / password (+ optional 2FA)**

```js
const api = await login({
  email: 'your-email@example.com',
  password: 'your-password'
}, { autoReconnect: true });
```

**Option 3 — Self-healing autoLogin (appstate + credentials on disk)**

```js
const api = await login({ appState: require('./appstate.json') }, {
  appStatePath: './appstate.json',       // refresher writes back here
  credentialsPath: './credentials.json', // email/password for re-login
  backupPath: './backups',               // cookie backups
  autoLogin: true,                       // re-login when cookies die
  autoSave: true,
  safeMode: true
});
```

---

## Login Options Reference

| Option | Default | Purpose |
|--------|---------|---------|
| `appState` | – | Cookie array from `appstate.json` — most stable path |
| `email` / `password` | – | Credential login (generates appstate) |
| `userAgent` | safe Chrome/141 | Explicit UA; becomes the session-locked fingerprint |
| `fingerprintLock` | `true` | One stable UA per session; `false` = legacy rotation |
| `randomUserAgent` | `false` | Deliberate per-request UA rotation (opt-in) |
| `appStatePath` | auto | Where cookies are persisted (env `NEXUS_APPSTATE_PATH`) |
| `credentialsPath` | auto | Where email/password are stored (env `NEXUS_CREDENTIALS_PATH`) |
| `backupPath` | auto | Cookie backup dir (env `NEXUS_BACKUP_PATH`) |
| `autoLogin` | `true` | Self-healing re-login when cookies die |
| `autoSave` / `safeMode` | `true` | Save credentials / conservative defaults |
| `persistentDevice` | `true` | Device fingerprint persistence |
| `enableE2EE` | `false` | Opt-in E2EE bridge (BETA, needs native deps) |
| `enableSafeDelays` | `true` | Human-like delays |
| `autoReconnect` | `true` | Auto reconnect on drop |
| `listenEvents` | `false` | Also emit non-message events |
| `forceLogin` | `false` | Force fresh login instead of appstate reuse |
| `autoMarkRead` / `updatePresence` | `false` | Read receipts / presence |
| `emitReady` | `false` | Emit a `ready` event after connect |
| `bypassRegion` | – | Force region (`PRN` etc., env `NEXUS_BYPASS_REGION`) |
| `proxy` | – | `http://` / `socks5://` proxy |
| `pageID` | – | Operate as a Facebook Page |
| `mqttMaxReconnectAttempts` | `Infinity` | Cap reconnect attempts (default: never give up) |
| `sessionGuard` | `true` | Skip-unchanged session writes |
| `antiLogout` / `facebookProtection` / `humanLikeDelay` | `true` | Protection opt-outs |
| `logLevel` / `pauseLog` / `logRecordSize` | – | Logging control |

Environment variables: `NEXUS_VERBOSE_MQTT`, `NEXUS_APPSTATE_PATH`, `NEXUS_CREDENTIALS_PATH`, `NEXUS_BACKUP_PATH`, `NEXUS_COOKIE_BACKUP_PATH`, `NEXUS_DEVICE_FILE`, `NEXUS_RANDOM_USER_AGENT`, `NEXUS_BYPASS_REGION`.

---

## Speed vs Safety

```js
api.setFastSend(true);        // maximum speed — bypass queue
api.setParallelSend(3);       // balanced (default)
api.setParallelSend(5);       // more speed, up to 5 concurrent
api.setParallelSend(1);       // maximum safety — sequential
api.enableGroupQueue(true);   // per-thread queue
api.setGroupQueueCapacity(100);
```

---

## Anti-Lock Behavior

```
login → dead cookies detected (typed pattern)
      → lock info exposed, NO process.exit
      → retry in 15 min → re-read appstate.json
      → still dead → 30 min → 60 min (cap) → keep re-reading
      → you replace appstate.json → next retry logs in fresh
```

The process stays alive and self-recovers as soon as a fresh cookie file is in place — no restart needed on ephemeral hosts.

---

## Key Runtime APIs

```js
api.setEditOptions({ maxPendingEdits, editTTLms, ackTimeoutMs, maxResendAttempts });
api.setBackoffOptions({ base, factor, max, jitter });
api.enableLazyPreflight(true);
api.getHealthMetrics();               // uptime, reconnects, ack latency, delivery stats
api.getMemoryMetrics();               // queue sizes and guard counters
api.getAppState();                    // current cookie state (deduped)
api.OldMessage(msg, threadID);        // legacy HTTP send fallback
api.connectE2EE(cb);                  // opt-in E2EE bridge (BETA)
```

Monitoring:

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

## Safety Architecture

| Layer | Mechanism | Purpose |
|-------|-----------|---------|
| UA Fingerprint Lock | One Chrome/141 identity per session | Consistent fingerprint across all subsystems |
| Login Guard | Typed lock-pattern detection at login | Catch dead cookies/checkpoints before MQTT |
| Retry Backoff | 15→30→60 min, re-reads cookie file | Self-recovery without restart |
| Adaptive Refresh | Risk-aware timing bands, 2–4 min initial delay | Token longevity without bursts |
| Lightweight Poke | Subtle `fb_dtsg` renewal | Keeps session warm quietly |
| Collision Guard | 45m spacing window | Prevents clustered maintenance events |
| Idle / Ghost Probe | Timed silent detection | Force reconnect on stale sockets |
| Periodic Recycle | Randomized (~6h ±30m) | Pre-empts silent degradation |
| Backoff Strategy | Exponential + jitter | Graceful network recovery |
| Circuit Breaker | 5 fails → 5-min cooldown | Protects against failure storms |
| Delivery Suppression | Disables receipts after repeated timeouts | Preserves send latency |

```js
await login({ appState }, { disablePreflight: true }); // skip preflight when embedding
```

---

## MQTT v5

- Runs on mqtt 5.16.1 with Facebook's exact `MQIsdp/3` protocol and custom `wsOptions` headers.
- Smart recovery: fetches a fresh Sequence ID before reconnecting on errors.
- Proactive randomized reconnects (26–60m); adaptive curve (cap 5 min); layered post-refresh probes (1s / 10s / 30s).
- Synthetic randomized keepalives (55–75s); structured error classification feeding metrics.
- Infinite reconnect by default (`mqttMaxReconnectAttempts` to cap).

## Delivery Reliability

- Multi-path fallback: **MQTT publish → HTTP send → direct → OldMessage** (legacy `messaging/send/`).
- Per-attempt timeout and retry for delivery receipts.
- Automatic classification of transient timeouts (ETIMEDOUT / ECONNRESET / EAI_AGAIN).
- Adaptive suppression of receipt calls on unstable environments.

---

## E2EE Bridge (opt-in, BETA)

```js
const api = await login({ appState }, { enableE2EE: true });
// requires: npm i koffi yumi-json-bigint (+ Labyrinth native binary)

api.connectE2EE((err, evt) => {
  if (err) return console.error(err);
  // encrypted events: e2eeMessage, e2eeMessageEdit, e2eeReaction, e2eeReceipt ...
});
api.getE2EEBridge();      // direct bridge handle
api.getE2EEDeviceData(cb);
```

Reactions and typing indicators automatically use E2EE routes when enabled (guarded — fall through to normal routes when off). Status: **BETA**.

---

## Massive-Load / Long-Session Best Practices

1. Prefer appstate reuse — cookie-only login is the most stable path.
2. Keep `appStatePath` set so the CookieRefresher can persist refreshes; keep `backupPath` for safety.
3. Never manually rotate the User-Agent — the fingerprint lock handles identity for the whole session.
4. Let the anti-lock backoff work — replace `appstate.json` and wait for the next retry; do not hot-restart.
5. Watch `getHealthMetrics()` before forcing reconnects; queue depth > 0 means work is flowing.
6. For multiple bot instances, give each its own data dir (`appStatePath`, `backupPath`).

---

## Using with GoatBot V2 and Similar Bots

| Goal | Steps |
|------|-------|
| Generate appstate | Credential login once → save `appstate.json` → configure the bot |
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

## Documentation Map

| Resource | Location |
|----------|----------|
| Full API Reference | `DOCS.md` |
| Usage Guide (Examples) | `USAGE-GUIDE.md` |
| API Methods Reference | `API-METHODS-REFERENCE.md` |
| Configuration Reference | `docs/configuration-reference.md` |
| Account Safety | `docs/account-safety.md` |
| Cookie Management | `docs/cookie-management.md` |
| Deployment Config | `docs/deployment-config.md` |
| New API Guides | `docs/` — story manager, sticker store, themes, notes, scheduler, buttons, E2EE |
| TypeScript Guide | `docs/TypeScript-Guide.md` |
| Changelog | `CHANGELOG.md` |

---

## Version History

| Version | Focus |
|---------|-------|
| **5.2.4** | 🧯 Calm checkpoint handling: Graph error 1357004 (account flagged) no longer masked by the mbasic synthetic SeqID — no more backoff-less MQTT hammering on an enforced session; the relogin contract takes over |
| **5.2.3** | 🏷️ Mention fix: parses the new `messageMetadata.data.Gb.asMap.data` shape (protobuf `asLong` scalars) so `event.mentions` is never empty again; multipart upload retry rebuilds the body instead of replaying a consumed stream |
| **5.2.2** | 🔐 Vault hardening: quota guard (vault sees only real cookie changes, max 1 PUT / 5 min), health server binds on the lock path (Koyeb kill-loop fix), vault push on login success |
| **5.2.1** | 🔐 Session Vault: refreshed sessions mirrored to `NEXUS_SESSION_VAULT_URL` (save) + freshest-copy restore at boot, failed-session fingerprinting — fixes the Koyeb cookie-death restart loop |
| **5.2.0** | ⚡ Lightspeed-2: all thread ops (unsend/delete/nickname/image/poll/emoji/participants/admin) + full message surface (mentions/locations/attachments) through `/ls_req`, shared task engine, idempotent fallbacks |
| **5.1.0** | ⚡ Lightspeed send: messages go through the Messenger app's `/ls_req` task channel (text/sticker/reply), automatic web fallback, tolerant ack extraction |
| **5.0.6** | Deep audit: atomic appstate writes (crash-proof), real `{signal}` refresh semantics, CookieRefresher disposal on re-login |
| **5.0.5** | Hidden-issue audit: fully-local `getUID` (third-party resolver removed), throttled appstate auto-persist, CookieRefresher timer hygiene |
| **5.0.4** | Advanced parity: local cookie-liveness probe (`login.utils.checkLiveCookie`), device identifiers, live listener options |
| **5.0.3** | Full GoatBot V2 surface audit: appState input normalization (cookie strings, `{name}` exports), string IDs in task acks, tolerant sendMessage reply target |
| **5.0.2** | Upstream main-framework sync: m_basic device-mode fix, MPageLoadClientMetrics UA fallback, live-interstitial handling |
| **5.0.1** | GoatBot V2 contract hotfix: canonical relogin error strings, `api.stopListening`, evidence-based mbasic dead-check |
| **5.0.0** | 🐐 GOAT Update: full GoatBot V2 compatibility audit, cookie jar integrity (poisoning crash fixed), session-file protection, clean upload errors, logger correctness |
| **4.4.1** | Session stability hotfix: evidence-based login validation, MQTT broker PUBACK compatibility, cookie refresher correctness, zero-warning boot |
| **4.4.0** | Production hardening: UA fingerprint lock, login-time dead-cookie guard, CookieRefresher wiring, massive-load protections (group queue/circuit breaker/TTL sweeps), sqlite WAL, deps modernized (mqtt 5.16 / uuid 11 / ws 8.22) |
| 4.3.x | E2EE bridge (BETA), storyManager, stickerStore, OldMessage fallback, createThemeAI endpoint fix, autoLogin subsystem, theme/sticker/friend APIs |
| 4.2.0 | Safety hardening: fingerprint-lock default, expanded DTSG extraction |
| 4.1.0 | Architecture upgrade: compatibility layer, anti-logout guard, header fixes |
| 3.4.0 | Performance: parallel sending (1–5), fast send mode, queue control APIs |
| 3.0–3.2 | Delivery metrics, edit reliability, memory guard |
| 2.1.x | Safety consolidation, UA continuity, session longevity |

Full details in `CHANGELOG.md`.

---

## Disclaimer

Not affiliated with Facebook. Use responsibly and comply with platform terms and local laws.

## Contributing

Focused PRs improving stability, safety heuristics, protocol coverage, or typings are welcome.

## License

MIT © 2025–2026 Nexus (Team Nexus) — [facebook.com/profile.php?id=61572587854836](https://www.facebook.com/profile.php?id=61572587854836)
