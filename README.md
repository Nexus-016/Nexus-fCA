<p align="center">
  <img src="https://i.ibb.co/Sk61FGg/Dragon-Fruit-1.jpg" alt="Nexus-FCA" width="480" />
</p>

# Nexus-FCA

[![npm version](https://img.shields.io/npm/v/nexus-fca)](https://www.npmjs.com/package/nexus-fca)
[![npm downloads](https://img.shields.io/npm/dm/nexus-fca)](https://www.npmjs.com/package/nexus-fca)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE-MIT)
[![GitHub](https://img.shields.io/badge/github-Nexus--016%2FNexus--fCA-blue)](https://github.com/Nexus-016/Nexus-fCA)

A hardened, high-performance Facebook Messenger client library for Node.js.

Nexus-FCA speaks the same task channel the Messenger application uses — the LightSpeed protocol over MQTT — and falls back to proven web endpoints transparently. It ships with full GoatBot V2 compatibility, a local-first session architecture (cookies never leave the machine), UA fingerprint locking, an anti-lock session guard, and bounded-memory delivery infrastructure designed for long-running, high-volume deployments.

---

## Highlights

**Native LightSpeed operations (v5.1–v5.3).** Message sending, edits, unsends, reactions, mentions, locations, attachments, polls, nicknames, group images, thread emoji, participants, admin status — and as of v5.3.0, mute, rename, member removal, group creation, message-request acceptance and poll voting — are published as native `/ls_req` tasks with wire shapes verified against independent open-source protocol references. Every operation degrades gracefully to the equivalent web endpoint on publish failure, task rejection or a missing acknowledgement; every fallback is idempotent.

**Session Vault (v5.2.1+).** Facebook rotates session cookies while the process runs. The vault mirrors every refreshed cookie state to a private JSON endpoint (`NEXUS_SESSION_VAULT_URL`) and restores the freshest copy at boot, so restarts never replay a dead `APPSTATE_JSON`. Failed copies are fingerprinted and alternate sources are tried automatically on the retry loop.

**Calm checkpoint handling (v5.2.4).** Graph error `1357004` — an account-level enforcement signal — is short-circuited instead of masked: no synthetic fallbacks, no backoff-less reconnect hammering. The session is handed to the relogin contract and the process recovers patiently (15 → 30 → 60 minute retry bands, health server bound).

**Local-first by design.** Login, sessions, listeners and every feature run on the machine the library runs on. Cookies are validated, refreshed and backed up locally; nothing is proxied through a third-party service.

---

## Feature Overview

| Area | Capability |
|------|------------|
| Transport | MQTT v5 (`MQIsdp/3`), adaptive backoff, idle/ghost detection, layered health probes |
| Messaging | Text, mentions, locations, stickers, emoji, attachments, replies, edits, unsends, reactions |
| Threads | Rename, mute, archive, delete, color, emoji, image, nickname, message requests |
| Groups | Create, participants, admin status, polls (create and vote) |
| Reliability | Per-thread queues, circuit breaker, TTL sweeps, bounded metrics, delivery fallback chain |
| Safety | UA fingerprint lock, login-time dead-cookie detection, anti-lock retry bands, adaptive pacing |
| Sessions | Cookie jar integrity, atomic appstate writes, adaptive refresh, Session Vault |
| Observability | `getHealthMetrics()`, `getMemoryMetrics()`, structured error types |
| Typings | First-class `index.d.ts` |

---

## Installation

Requires Node.js >= 20.

```bash
npm install nexus-fca
```

## Quick Start

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

**Option 2 — Email / password (+ optional TOTP 2FA)**

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

## Session Vault

Facebook rotates `xs`/`fr` cookies during a live session; a persisted `APPSTATE_JSON` therefore ages out while the process runs — the primary cause of cookie-death restart loops on ephemeral hosts.

1. Host a private JSON store (a private [jsonbin](https://jsonbin.io) bin, or any HTTP JSON endpoint).
2. Set `NEXUS_SESSION_VAULT_URL` (and `NEXUS_SESSION_VAULT_TOKEN` when required).
3. Seed it once with a fresh cookie export.

From then on the vault is the source of truth: refreshed cookie states are mirrored to it (with a quota guard so only real cookie changes are written, at most one `PUT` per 5 minutes) and the boot flow restores the freshest copy. If a login fails, the bot fingerprints the exact copy that failed and alternates sources on the retry loop instead of replaying the same dead session.

---

## LightSpeed Task Engine

All native operations flow through one internal publisher that owns the `/ls_req` envelope (app id, version id, epoch id, optional data-trace id), the acknowledgement routing, the 15-second ack timeout and cleanup.

- **Single discipline everywhere**: a publish error, a task-level rejection or a missing ack rejects the operation and the caller falls back to the equivalent web path.
- **Idempotent fallbacks**: every migrated operation is safe to re-apply, so a fallback can never corrupt thread state.
- **Non-idempotent operations are guarded**: group creation (label 130) falls back to the web path only when the task provably never ran; on an unknown-outcome timeout it reports explicitly instead of risking a duplicate group.
- **Runtime version resolution**: the current LightSpeed version id is resolved from the `LSVersion` module served by messenger.com (cached, single-flight, silent) so new operations survive protocol deployments.
- **Strict acknowledgement typing**: task responses route by type; unknown ack types are surfaced as errors so the fallback chain can act.

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
| `enableE2EE` | `false` | Opt-in E2EE bridge (beta, needs native deps) |
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

The process stays alive and self-recovers as soon as a fresh cookie file is in place — no restart needed on ephemeral hosts (Koyeb, Render, Heroku).

---

## Key Runtime APIs

```js
api.setEditOptions({ maxPendingEdits, editTTLms, ackTimeoutMs, maxResendAttempts });
api.setBackoffOptions({ base, factor, max, jitter });
api.enableLazyPreflight(true);
api.getHealthMetrics();               // uptime, reconnects, ack latency, delivery stats
api.getMemoryMetrics();               // queue sizes and guard counters
api.getAppState();                    // current cookie state (deduped)
api.getDeviceIdentifiers();           // stable { deviceID, familyDeviceID, machineID }
api.OldMessage(msg, threadID);        // legacy HTTP send fallback
api.connectE2EE(cb);                  // opt-in E2EE bridge (beta)
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

## E2EE Bridge (opt-in, beta)

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

Reactions and typing indicators automatically use E2EE routes when enabled (guarded — fall through to normal routes when off).

---

## Massive-Load / Long-Session Best Practices

1. Prefer appstate reuse — cookie-only login is the most stable path.
2. Keep `appStatePath` set so the CookieRefresher can persist refreshes; keep `backupPath` for safety.
3. Never manually rotate the User-Agent — the fingerprint lock handles identity for the whole session.
4. Let the anti-lock backoff work — replace `appstate.json` and wait for the next retry; do not hot-restart.
5. Watch `getHealthMetrics()` before forcing reconnects; queue depth > 0 means work is flowing.
6. For multiple bot instances, give each its own data dir (`appStatePath`, `backupPath`).
7. If an account is flagged, stop the bot for 24 hours and complete the checkpoint in a real browser before redeploying.

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
| Documentation Overview | `DOCS.md` |
| Complete API Reference | `COMPLETE-API-DOCS.md` |
| API Methods Reference | `API-METHODS-REFERENCE.md` |
| Usage Guide (Examples) | `USAGE-GUIDE.md` |
| Configuration Reference | `docs/configuration-reference.md` |
| Account Safety | `docs/account-safety.md` |
| Cookie Management | `docs/cookie-management.md` |
| Deployment Config | `docs/deployment-config.md` |
| Feature Guides | `docs/` — story manager, sticker store, themes, notes, scheduler, buttons, E2EE |
| TypeScript Guide | `docs/TypeScript-Guide.md` |
| Changelog | `CHANGELOG.md` |

---

## Version History

| Version | Focus |
|---------|-------|
| **5.3.0** | LightSpeed parity sprint II: mute (144), rename (32), remove-participant (140), create-group (130), accept-message-request (66), votePoll (164, new API), editMessage engine-normalized — native task paths with silent idempotent web fallbacks and runtime LSVersion resolution |
| **5.2.4** | Calm checkpoint handling: Graph error 1357004 (account enforcement) short-circuited instead of masked — no backoff-less MQTT hammering; the relogin contract takes over |
| **5.2.3** | Mention fix: parses the current `messageMetadata` mention shape (protobuf `asLong` scalars) so `event.mentions` is never empty; multipart upload retry rebuilds the body instead of replaying a consumed stream |
| **5.2.2** | Vault hardening: quota guard (max 1 PUT / 5 min, real cookie changes only), health server binds on the lock path, vault push on login success |
| **5.2.1** | Session Vault: refreshed sessions mirrored to `NEXUS_SESSION_VAULT_URL` + freshest-copy restore at boot, failed-session fingerprinting |
| **5.2.0** | LightSpeed-2: all thread operations (unsend/delete/nickname/image/poll/emoji/participants/admin) and the full message surface (mentions/locations/attachments) through `/ls_req` with a shared task engine |
| **5.1.0** | LightSpeed send: messages published through the Messenger task channel (text/sticker/reply), automatic web fallback, tolerant ack extraction |
| **5.0.6** | Deep audit: atomic appstate writes, real `{signal}` refresh semantics, CookieRefresher disposal on re-login |
| **5.0.5** | Hidden-issue audit: fully local `getUID`, throttled appstate auto-persist, CookieRefresher timer hygiene |
| **5.0.4** | Advanced parity: local cookie-liveness probe (`login.utils.checkLiveCookie`), device identifiers, live listener options |
| **5.0.3** | Full GoatBot V2 surface audit: appState input normalization, string IDs in task acks, tolerant reply targets |
| **5.0.2** | Upstream main-framework sync: m_basic device-mode fix, UA fallback for bootstrap recovery, live-interstitial handling |
| **5.0.1** | GoatBot V2 contract hotfix: canonical relogin error strings, `api.stopListening`, evidence-based mbasic dead-check |
| **5.0.0** | Compatibility update: full GoatBot V2 method audit, cookie jar integrity (poisoning crash fixed), session-file protection, clean upload errors, logger correctness |
| **4.4.1** | Session stability hotfix: evidence-based login validation, MQTT broker PUBACK compatibility, cookie refresher correctness, zero-warning boot |
| **4.4.0** | Production hardening: UA fingerprint lock, login-time dead-cookie guard, CookieRefresher wiring, massive-load protections, sqlite WAL, dependencies modernized (mqtt 5.16 / uuid 11 / ws 8.22) |
| **4.3.x** | E2EE bridge (beta), storyManager, stickerStore, OldMessage fallback, theme/sticker/friend APIs |
| **4.2.0** | Safety hardening: fingerprint-lock default, expanded DTSG extraction |
| **4.1.0** | Architecture upgrade: compatibility layer, anti-logout guard, header fixes |
| **3.4.0** | Performance: parallel sending (1–5), fast send mode, queue control APIs |
| **3.0–3.2** | Delivery metrics, edit reliability, memory guard |
| **2.1.x** | Safety consolidation, UA continuity, session longevity |

Full details in `CHANGELOG.md`.

---

## Disclaimer

This project is not affiliated with, endorsed by, or connected to Meta Platforms, Inc. in any way. Use responsibly, in accordance with platform terms and applicable local laws.

## Contributing

Focused pull requests improving stability, safety heuristics, protocol coverage or typings are welcome.

## License

MIT © 2025–2026 Nexus (Team Nexus) — [facebook.com/profile.php?id=61572587854836](https://www.facebook.com/profile.php?id=61572587854836)
