# Changelog

## [5.0.5] - 2026-11-15 - 🔎 HIDDEN-ISSUE AUDIT (COOKIE / ACCOUNT / STABILITY / PERFORMANCE)

Full audit of the cookie-death, account-safety, GoatBot V2 compatibility, stability and performance surfaces, with fixes for everything found.

### Fixed
- **`api.getUID` is now fully local**: the previous implementation posted every profile link to a third-party resolver (`id.traodoisub.com`), leaking the bot's browsing targets and adding a third-party point of failure — and its fallback path was dead code that called a non-existent `utils.error` helper (the catch block itself threw). The rewritten resolver: returns ids already present in the link (`profile.php?id=`, numeric paths, bare numeric input) without any request; resolves vanity links by fetching the profile page **through the bot's own session** (same UA + cookies as every other request — fingerprint stays consistent, nothing leaves the machine); detects a login-page response and reports it as a session problem instead of a generic failure. Clean callback/promise contract preserved.
- **Performance — appstate auto-persist throttled**: busy sessions receive `Set-Cookie` on most responses and the auto-persist performed a synchronous `writeFileSync` per response on the hot request path. Saves are now coalesced to at most one write per 10 seconds with a trailing flush, so the latest cookie state still lands on disk. The safety gate (never overwrite the session file with a set missing `c_user`/`xs`) is unchanged.
- **Stability — CookieRefresher retry timer no longer holds the process open**: the 15-minute retry `setTimeout` after a failed refresh is now unref'd, like the main refresh timer.

### Verified
- 55-check upstream-compat suite (8 sections, new section covers getUID local resolution + the save throttle), 34-check regression suite, 14-check contract suite — all green in both copies.

## [5.0.4] - 2026-11-14 - ✨ ADVANCED PARITY (LOCAL)

Reviewed `neokex-fca`'s advanced feature set at the user's request and brought the genuinely useful ones into Nexus-fCA — **implemented locally**, unlike neokex which is a thin client that uploads every cookie and every call to its own server (`fca.neokex.xyz`).

### Added
- **`login.utils.checkLiveCookie(input, options)` (sessionless liveness probe)**: checks whether a cookie set still authenticates without creating a session and without writing anything — accepts an exported cookie array, a raw cookie string (`"c_user=...; xs=...;"`), a cookies.txt (Netscape) export, or a jar-like object; returns `{ live, accountID, reason, checkedAt }`. Evidence-based (account id + settings markup = live; a real login form = dead). Implemented locally — the cookies never leave the machine. The existing session-based `checkLiveCookie(ctx, defaultFuncs)` keeps its signature (used internally by the listener) via smart dispatch.
- **`api.getDeviceIdentifiers()`**: the device identity the session presents — `{ deviceID, familyDeviceID, machineID }`, persisted next to the account's `appstate.json` so the fingerprint is stable across restarts. `machineID` is a stable sha256 fingerprint of the device profile.
- **`api.setListenerOptions(options)` / `api.getListenerOptions()`**: update/read the listener option subset live (`selfListen`, `selfListenEvent`, `listenEvents`, `listenTyping`, `updatePresence`, `autoMarkDelivery`, `autoMarkRead`, `autoReconnect`, `online`, `emitReady`); returns `{ updated: string[] }`.

### Note on neokex-fca
Its "advanced" features (music stickers, effects, bump) live in a closed server engine — the published npm client contains only API metadata and uploads the user's appState to `fca.neokex.xyz` in `POST /v1/sessions`, then proxies every call. Nexus-fCA keeps every session local: cookies, listeners and features all run on the user's own machine. Its locally-listed extras (`listEffects`/`listAvatarEffects`) also resolve from the server manifest, not from the client.

### Verified
- 45-check upstream-compat suite (now covering the advanced parity surface), 34-check regression suite, 14-check contract suite — all green.

## [5.0.3] - 2026-11-14 - 🧩 FULL GOATBOT V2 SURFACE AUDIT

Completed the full surface audit the earlier audits only sampled: every API method the upstream main GoatBot V2 FCA exposes, every event type the bot's handlerAction dispatches, and the dev-user input shapes the upstream FCA accepts.

### Added
- **appState input normalization (upstream `loginHelper` parity)**: the upstream main-framework FCA accepts every dev-user input shape and normalizes them; ours threw. Now all shapes land as the internal `{key, value, domain, path, expires}` array: a raw cookie string (`"c_user=...; xs=...;"`), a JSON array string, cookie exports in `{name, value}` shape (renamed to `{key, value}` like upstream), or an already-normalized array (idempotent). Junk input now fails with a clear, actionable message instead of a bare parse error. Applied at every entry point (`loginHelper`, `login()`, `validateLogin`, `loginWithAppState`), so safety validation sees the final shape.

### Fixed
- **Task-response IDs are always strings**: the MQTT `/ls_resp` task ack for our own sends could carry the messageID/threadID/mid as numbers (Facebook encodes some payload fields numerically), while later events carry them as strings — the exact mismatch the bot framework added a type-tolerant reply lookup for. All task-response identifiers (`send_message_mqtt` threadID/messageID, `set_message_reaction`/`edit_message` mid) are now stringified at emission, matching upstream behavior.
- **Numeric replyToMessage accepted**: `sendMessage` rejected a numeric reply target with "MessageID should be of type string". It is now coerced to string (other invalid types are still rejected), matching the bot framework's ID-type tolerance.

### Verified (full surface)
- All 53 upstream `fb-chat-api` apiFuncNames present in our FCA (`addExternalModule` … `httpPostFormData`), plus `api.setOptions`/`getAppState`/`listen` alias/`stopListening`.
- All 8 event types the bot's `handlerAction` dispatches are emitted: `message`, `message_reply`, `message_unsend`, `event`, `message_reaction`, `typ`, `presence`, `read_receipt` — with upstream shapes (`read_receipt` via `formatDeltaReadReceipt`).
- 32-check upstream-compat suite, 14-check contract suite, 34-check regression suite all green.

## [5.0.2] - 2026-11-14 - 🔗 UPSTREAM MAIN-FRAMEWORK SYNC

Re-audited the changed Goat-X-Nexus bot framework and synced the login chain with the upstream main GoatBot V2 framework (its final `1.5.35` "fix: fca not working" commit), which fixed two login-time failure modes on datacenter hosting.

### Added
- **m_basic device-mode fix (login chain)**: Facebook serves a "This browser is not supported" interstitial to logged-in sessions on datacenter IPs (Koyeb/Railway). It embeds a `gfid` for the m_basic device-switch link; following that link flips the session to m_basic device mode so the home page serves bootstrap markup that `buildAPI` can parse (fb_dtsg + MQTT endpoint/region). Without it, the page yielded no fb_dtsg, the graphqlbatch SeqID fetch failed and the listener never came up. Runs in the upstream order: redirect → device fix → MPageLoadClientMetrics UA fallback → redirect → device fix.
- **MPageLoadClientMetrics UA fallback**: a desktop-UA fetch of the home page can lack `MPageLoadClientMetrics` (the bootstrap marker exposing region/seqID). One refetch with an iPhone UA restores it. The pinned session UA is untouched (request-local copy), and every step is best-effort — network failures pass through without failing the login.

### Fixed
- **Browser-not-supported interstitial no longer declared dead**: the login-time dead-session evidence check treated the interstitial as "no account proof" and threw before the device-mode recovery could run. It is a LIVE-session interstitial, so it now returns the response untouched and lets the recovery chain handle it (dead sessions still throw on real login forms, and checkpoint markers remain decisive).

### Verified against the changed bot framework + upstream
- The bot's new listener-callback contract is fully satisfied: exact relogin strings (`"Not logged in"` / `"Not logged in."` / `"Connection refused: Server unavailable"`), `api.stopListening(cb)` before every relisten, `event.messageID` loop detection, whitelist `senderID`/`userID`/`threadID` fields — all present.
- The bot's new messageID-type-tolerant reply lookup works with our listener (messageIDs emitted as strings; the bot's new tolerant lookup also accepts numbers defensively).
- 23-check upstream-compat suite, 14-check contract suite and 34-check regression suite all green.

## [5.0.1] - 2026-11-14 - 🔗 GOATBOT V2 CONTRACT HOTFIX

Audited the GoatBot V2 framework end-to-end (its real login flow, listener callback and error handling) and fixed three contract mismatches that made the bot freeze or duplicate listeners instead of relogging in.

### Fixed
- **Listener error contract (critical)**: the bot's `callBackListen` matches the literal strings `error.error == "Not logged in."` / `"Connection refused: Server unavailable"` to trigger its relogin/restart flow. Nexus emitted custom messages (`"Not logged in (Auto-recovery failed)"`, the raw broker error, ...) which failed the match — the bot logged the error and then did nothing: the listener stayed dead with no relogin and no restart. All dead-session sites now emit the canonical `"Not logged in."` (raw detail preserved in the `message` field, which the bot's lock detector also reads).
- **`api.stopListening` added (critical)**: the bot's `stopListening()` calls `api.stopListening(cb)` before every relogin/relisten. It was missing, so the old MQTT connection survived restarts and every event was processed twice (duplicate replies). The new method force-ends the current MQTT client and notifies the caller; a missing client is a safe no-op.
- **mbasic SeqID fallback dead-check made evidence-based (hidden bug)**: `getSeqIdFromMbasic` threw "Not logged in on mbasic" when the body contained bare `login` + `password` substrings — but logged-in mbasic pages also embed escaped login.php URLs and password-field markup in their prefetch config (the same false-positive class fixed for login in 4.4.1). Alive = this account's id in the page; a real login form without proof is the only dead signal.

### Verified against the upstream GoatBot V2 framework
- `login({ appState }, options, cb)` — callback contract, sync `getCurrentUserID()`, `getAppState()` array, `getThreadList(9999999, null, 'INBOX')` shape (`isGroup`/`threadID`), `getThreadInfo().inviteLink`, `getUserInfo()` name shape, `message`/`message_reply` event types — all present and matching.
- 14-check contract suite passes; previous suites re-run green.

## [5.0.0] - 2026-11-14 - 🐐 GOAT UPDATE — GoatBot V2 FULL COMPATIBILITY

### Overview
The GOAT update makes Nexus-FCA fully drop-in for GoatBot V2: every API method the bot calls is verified present with matching semantics, and two field-reported session/data-integrity failures are fixed at the root. 34-check verification suite passes.

### Fixed
- **Cookie jar poisoning crash (critical)**: `CookieRefresher._extendCookieExpiry` assigned a UTC **string** to the `expires` field of the jar's *live* cookie objects (`getAppState` returns the jar's own cookies, not copies). tough-cookie requires `expires` to be a Date or `"Infinity"` — with a string in the jar, every later `getCookies` / `getCookieString` call failed with `TypeError: this.expires.getTime is not a function` (the sync read silently returned nothing while an unhandled rejection killed the process). Reproduced with the exact stack from the field (`matchingCookie → Cookie.expiryTime`). The refresher now assigns a real `Date`, and a new `utils.sanitizeCookieJar(jar)` repairs any cookie whose expiry lost its type using the store's `getAllCookies` (safe to run even on an already-poisoned jar). It runs before every refresher read, before every session-guard save, and the safety health-check self-heals and retries once if a read throws.
- **Session file destroyed by incomplete save (critical)**: the field report "wrote a cookie set without c_user/xs, destroying the session file". Auto-savers now refuse to persist an incomplete cookie set: `utils.isSafeAppState(appState)` requires the session core (`c_user` + `xs`) and both the session guard (every 3 min) and the refresher save check it before touching the file — a broken set logs a warning and the previous appstate is kept untouched.
- **`uploadAttachment` retry storm on permanent errors**: a deleted tmp attachment (ENOENT) retried 3 times and dumped got's full stack per attempt. Permanent local errors (`ENOENT`, `EACCES`, `EPERM`, `EISDIR`, ...) now fail fast — no retry — with one actionable line: `Attachment file not found: <path> — the file must exist until the upload completes`. Transient network errors still retry up to 3 attempts.
- **Logger signature mismatch**: `lib/logger` exported `(text, level)` but modules called `logger("Module", "message", "level")` — the module name was printed as the message and the real text was dropped (the mysterious repeated `[ Nexus-FCA ] › CookieRefresher` lines). Both signatures now work (`[Module] message` is composed), `success` got a proper level, and `debug` is gated behind `NEXUS_DEBUG=1`.
- **Cookie object entry hardening**: cookies entering the jar as objects are normalized in the `getJar()` wrapper — `expires` string/number → Date (or `"Infinity"`), and a leading-dot `domain` is stripped exactly like tough-cookie's own parser does (in v5 a dot-prefixed domain cookie never matches any URL).

### GoatBot V2 compatibility (verified against the bot's real call sites)
Every `api.*` method GoatBot V2 actually calls is present with matching semantics: `sendMessage`, `sendMessageMqtt`, `sendTypingIndicator`, `sendTypingIndicatorV2`, `getThreadInfo`, `getThreadList` (INBOX shape with `isGroup`/`threadID`), `getUserInfo`, `getAppState`, `setOptions`, `listenMqtt` (GoatBot event shapes), `markAsRead`, `markAsDelivered`, `setMessageReaction`, `unsendMessage`, `refreshFb_dtsg`, `changeNickname`, `changeThreadColor`, `changeThreadEmoji`, `changeGroupImage`, `setThreadTheme`, `createThemeAI`, `setTitle`, `addUserToGroup`, `removeUserFromGroup`, `getCurrentUserID`, `getAvatarUser`, `resolvePhotoUrl`, `getFriendsList`, `getThreadHistory`, `muteThread`, `uploadAttachment` and more — a compatibility audit is part of the test suite.

### Verification
- 34-check suite: cookie normalization (8), jar object gate (3), poisoned-jar self-heal incl. the exact field crash (5), session-file protection gate (5), refresher expiry/save behavior (4), logger dual signature (4), upload ENOENT fail-fast + transient retry (3). All pass.
- Previous suites re-run green: refresher 9/9, MQTT normalizer 10/10, login classification suite 9/10 — the one failing check is the live fresh-login attempt against our test account, whose session Facebook invalidated server-side; the identical failure occurs on the previous release (4.4.1), confirming it is environmental, not a regression.

## [4.4.1] - 2026-11-13 - 🔧 SESSION STABILITY HOTFIX

### Overview
Three production-blocking session bugs are fixed and verified against live Facebook traffic: fresh cookies are no longer rejected at login, the MQTT listener no longer dies on the broker's non-compliant PUBACK replies, and the cookie refresher no longer reports healthy sessions as failed.

### Fixed
- **Login false-positive (critical)**: `loginWithAppState` matched a bare `"/login.php"` substring — but logged-in home pages embed escaped login.php URLs in their prefetch/bootstrap config, so fresh cookies were rejected as "cookie session expired". Detection is now evidence-based: the session counts as alive when the account's `c_user`/`i_user` id appears in the page bootstrap (a real login form is the fallback signal), and a suspicious page is confirmed once against `home.php` before it is declared dead. Checkpoint markers stay decisive.
- **MQTT reconnect loop (critical)**: Facebook's edge-chat broker now answers QoS-1 PUBLISHes with MQTT5-style PUBACK headers (flag bits set), while the mqtt-packet parser (9.0.2, latest) still enforces `flags == 0x0` for PUBACK — the session died right after queue creation with `Invalid header flag bits, must be 0x0 for puback packet` and looped reconnects forever. `buildStream` now normalizes incoming WebSocket buffers (`normalizeBrokerMqttPackets`): non-compliant PUBACKs are rewritten in place (flags cleared, a present reason code stripped); compliant packets pass through untouched. Also keeps QoS-1 sends stable mid-session.
- **Cookie refresher false failure (critical)**: `performRefresh` used `defaultFuncs.get`, which injects API-style query params (`__a=1`, `__user`, `fb_dtsg`...) — Facebook rejects a plain page GET carrying those with error 1357004 in a ~250-byte async wrapper, and the success criterion (`res.headers["set-cookie"]` present) can never be met on a healthy session anyway: once every cookie is still valid, Facebook sends no Set-Cookie at all. Refreshes now use the plain `utils.get` request shape (same as login) and success = sane status + the account id present in the page body.
- **`refreshFb_dtsg` false "Session expired"**: the token refresher's dead-check used the same bare-substring matching and warned "Session expired" on every cycle of a healthy session. Dead-check is now evidence-based (`ctx.userID` present in the page = proof; www.facebook.com is proof-trusted, other sources require an explicit login form), and the self-heal restart is keyed on the `sawSessionExpired` flag instead of error-message matching.
- **Appstate-path option spelling**: the CookieRefresher resolver read only `appstatePath` and ApiFactory only `appStatePath` — both now accept either spelling.
- **Boot noise**: `attachSrcMethods` no longer warns for `autoLogin.js` (it intentionally exports helpers as an object; `createPerformAutoLogin` is wired directly in the context builder).

### Verification (live, against real Facebook endpoints)
- Fresh-cookie login succeeds (full logged-in page); corrupted cookies still route into the anti-lock guard. 10/10 checks.
- MQTT: CONNACK + SUBACKs + QoS-1 PUBACKs parsed, `/t_ms` firstDelta + syncToken received, presence updates flowing, zero reconnects across the observation window. 10/10 checks.
- Cookie refresher: immediate refresh succeeds, `appstate.json` saved with extended expiry, backup created. 9/9 checks.
- A full login boot logs zero warnings.

## [4.4.0] - 2026-11-12 - 🛡️ PRODUCTION HARDENING + DEPS MODERNIZATION
- **UA fingerprint lock**: one stable Chrome/141 UA per session — login = HTTP headers = MQTT = cookie check all share it (seeded from `globalOptions.userAgent`), stored in `Fca_Database/safety_store.json` (stale-version UAs rejected on load).
- **Login-time dead-cookie detection**: expired cookies caught in `LoginManager` before MQTT start; typed lock patterns (checkpoint / unusual_activity / account_locked / verification_required / login_approval / `cookie_invalid`) with patient retry backoff 15→30→60 min that re-reads `appstate.json` — never a hot `process.exit`.
- **CookieRefresher actually runs**: `appStatePath` wired through, first refresh delayed 2–4 min after login, sessionGuard skips unchanged state, `getAppState` dedupes duplicate cookies (linux/windows platform hints fixed).
- **Massive-load protections**: per-thread group queue (cap 100, 3 parallel) with deadlock-proof `processQueue` (sync throws can no longer strand the queue), `_pendingOutbound` TTL sweep (3 min) + 1000 cap, circuit breaker wired through the callback path, `smartSafetyLimiter` per-user session pruning, bounded ack-latency samples, editSettings maxPendingEdits cap.
- **sqlite hardening**: WAL + `busy_timeout 5000` on every database, 24h metrics retention.
- **Dependencies modernized**: mqtt 4→5.16.1 (live-tested MQIsdp/3 + custom `wsOptions` headers over WS), uuid 9→11.1 (last require()-compatible major), ws 8.22.2, cheerio/axios pinned current, tough-cookie/jar-support aligned to runtime-proven 5.x; `engines >= 20`.
- Console noise removed: per-send MQTT payload dumps now gated behind `NEXUS_VERBOSE_MQTT=1`.

### Fixed (4.4.0 work)
- `user-agents.js`: Chrome 131-133 -> 139-141 (Oct 2026 stable), added Linux, `windowsUserAgent` export for GoatBot compat
- `setOptions` default UA Chrome 131 -> 141
- `ctx.lsd`/`ctx.master`/`ctx.jazoest` now populated so `utils.getHeaders` sends real `X-Fb-Lsd`/`X-Fb-Spin-*`
- `sendTypingIndicatorV2` alias, `fbDtsgRefreshMs` configurable via globalOptions

## [4.3.1] - 2026-10-16 - 🎨 AI THEME ENDPOINT FIX
- Root cause of `field_exception 1675030`: AI generation mutation only resolves on `web.facebook.com` - `www.facebook.com` returns null data. 
- `createThemeAI`: posts to `web.facebook.com/api/graphql/`, form (`qpl_active_flow_ids`, analytics tags, `i_userID` actor, `fb_dtsg`, `client_mutation_id: "1"`).
- Console cleanup: no more full-response dump on success; short error line only (full err still goes to caller).

## [4.3.0] - 2026-10-16 - 📦 E2EE + STORY + STICKERS + FALLBACK
- **E2EE bridge (opt-in, off by default)**: `e2ee.js` + `lib/e2ee/index.mjs` (Labyrinth native bridge), `src/e2eeBridge.js` wiring: `api.connectE2EE(cb)`, `api.getE2EEBridge()`, `api.getE2EEDeviceData(cb)`. E2EE routes added to `setMessageReaction` + `sendTypingIndicator` (guarded, fall through when off). Enable: login `{ enableE2EE: true }` + `npm i koffi yumi-json-bigint` + Labyrinth native binary. Status: BETA - needs live secret-chat test.
- **storyManager**: `api.storyManager({action:'add'|'upload'|'delete'|'check', attachment, storyID})` - story create/delete/list.
- **stickerStore**: `api.stickerStore.{search, listPacks, getStorePacks, listAllPacks, addPack, getStickersInPack, getAiStickers}`. `searchStickers` untouched.
- **OldMessage fallback**: `api.OldMessage(msg, threadID)` - legacy HTTP `messaging/send/` path when MQTT send fails.
- **AI theme upgrade**: `api.createThemeAI(prompt, numThemes?)` now supports up to 10 themes + returns `allThemes` (mutation already current).

## [4.2.0] - 2026-10-16 - 🛡️ SAFEST ROUND
- **Fingerprint lock** (biggest fix): `utils.getHeaders` used to rotate UA+ClientHints on EVERY request - a bot signal no real browser ever gives. Now one UA locked per session (`ctx._fpLocked`). Opt-out: `fingerprintLock:false`. Compat: `randomUserAgent:false` + `userAgent` string = fixed UA. `getHeaders`/`hintsForUA` exported for tests.
- **Randomized fb_dtsg refresh**: fixed 20min -> random 15-25min each cycle (override: `fbDtsgRefreshMs` fixed, `fbDtsgRefreshJitter:false`).
- **Send circuit breaker (light)**: 5 consecutive spam/block/checkpoint/rate-limit/restrict failures -> 5min cooldown with 30s slow sends. Resets on success.
- Competitive survey confirms the fingerprint-lock default is the safer approach; `randomUserAgent` remains opt-in for multi-account setups.

## [4.1.1] - 2026-10-16 - ⌨️ TYPING INDICATOR FIX
- Root cause: `sendTypingIndicator` used dead HTTP endpoint `ajax/messaging/typ.php` (mercury-chat, removed by FB years ago) - typing never showed.
- Fix: publish MQTT `/ls_req` type-4 label-3 with shared `ctx.wsReqNumber`. MQTT down = silent skip (cosmetic only).
- Dual signature: NEW `api.sendTypingIndicator(true, threadID)` + OLD `api.sendTypingIndicator(threadID)` (returns `end()` to stop) - `Thread.startTyping()` keeps working.

## [4.1.0] - 2026-10-16 - 🆕 NEW + UPDATED APIs

### New APIs (Nexus-এ ছিল না, এখন `api.*` হিসাবে auto-attach হয়)
- `sendFriendRequest(userID)` - GraphQL Comet mutation দিয়ে friend request
- `searchFriends(query)` - mutual friend + relevance sort সহ friend search
- `setActiveStatus(bool)` - online/offline visibility (UpdatePresenceSettingsMutation)
- `sendButtons(ctaId, text, threadID)` - MQTT label-46 CTA/button message
- `setProfileLock(bool)` - profile lock toggle (WemPrivateSharingMutation)
- `setStorySeen(storyID)` - story seen mark (storiesUpdateSeenStateMutation)
- `getThreadTheme(themeID)` / `setThreadTheme(threadID, themeFBID)` - theme read + full apply (AI-theme queues সহ)
- `note.check/create/delete/update` - Messenger Notes (Rich Status) management
- `changeAvatarV2(imageURL, caption)` - updated avatar flow (upload + ProfileCometProfilePictureSetMutation), পুরনো `changeAvatar` untouched

### Verified already-up-to-date (কোনো change লাগেনি)
- `setMessageReaction` - doc_id `1491398900900362` confirmed, E2EE route supported.
- `pinMessage` - pin + unpin দুটোই support করে

### Deferred (পরে)
- AI theme generate + AI sticker pack, E2EE bridge, storyManager, OldMessage fallback, auto-update checker

## [4.0.0] - 2026-10-16 - 🏆 MAJOR ARCHITECTURE UPGRADE

### Hardening improvements
- **Anti-logout guard**: `logout` blocked, `forceLogout`/`stopAntiLogout`, `sessionGuard` auto-save every 3min + `saveSession`, `fb_dtsg` auto-refresh every 20min (was 24h), `humanLikeDelay` 50-200ms, `facebookProtection` option, `getHealth()` snapshot
- **Adaptive rate limiting** intact + `refreshFcaConfig()` runtime reload, domain-compat aliases
- **LSD/spin/jazoest/hsi extraction** + `X-Fb-Lsd` headers fixed (ctx.lsd was never set - bug), expanded DTSG regex, JSON-script fallback kept
- **E2EE-ready structure** + update-check notice (manual `npm i nexus-fca@latest`)
- **MQTT 24h**: `MqttManager` infinite reconnect (was max 10), max delay 30s -> 5min + jitter, factor 1.5

## [3.4.0] - 2026-01-18 - ⚡ PERFORMANCE REVOLUTION

### Overview
Version 3.4.0 introduces **revolutionary performance improvements** that make Nexus-FCA as fast as competitors while retaining all safety features! New parallel messaging system eliminates reply delays with configurable concurrency levels. Users can now choose their speed vs safety balance.

### 🎉 Major New Features
- **⚡ Parallel Message Sending (`setParallelSend`)**: Send multiple messages concurrently! Configure 1-5 parallel sends. Default is 3 for balanced speed/safety.
- **🚀 Fast Send Mode (`setFastSend`)**: Bypass the message queue entirely for instant replies. Matches competitor libraries' speed.
- **📊 Queue Control APIs**: New `enableGroupQueue()` and `setGroupQueueCapacity()` for fine-grained control.
- **🔧 Smart Concurrency**: Changed from sequential boolean lock to counter-based concurrent processing system.

### 🔧 Technical Changes
- **ApiFactory.js - Group Queue System Rewrite**:
  - Replaced `sending: boolean` with `activeSends: number` counter for concurrent tracking
  - Added `processQueue()` while loop for parallel message processing
  - New `globalOptions.parallelSendMax` (default: 3, max: 5)
  - New `globalOptions.fastSendEnabled` for queue bypass
- **index.d.ts**: Added TypeScript definitions for all new methods

### ⚡ Performance Comparison
| Mode | Concurrent Sends | Speed | Safety Level |
|------|------------------|-------|--------------|
| `setFastSend(true)` | Unlimited (no queue) | 🚀 Maximum | ⚠️ Low |
| `setParallelSend(5)` | 5 | ⚡ Very Fast | ✅ Medium |
| `setParallelSend(3)` | 3 (Default) | ⚡ Fast | ✅ Good |
| `setParallelSend(1)` | 1 | 🐢 Sequential | ✅✅ Maximum |

### 🎯 Usage Examples
```js
// Maximum Speed
api.setFastSend(true);

// Balanced (Default) - Fast + Safe
api.setParallelSend(3);

// More Speed
api.setParallelSend(5);

// Maximum Safety
api.setParallelSend(1);
api.setFastSend(false);
```

### 📊 Benchmark Results
- **Before (3.3.0)**: ~500ms per message (sequential)
- **After (3.4.0)**: ~150ms effective (3 parallel) / Instant (fast send)
- **Improvement**: 3x faster default, 5x+ with fast send mode

### ✅ Backwards Compatibility
No breaking changes! Existing code works identically. New features are additive and defaults are balanced.

---

## [3.1.0] - 2025-11-22 - 🏆 THE BEST FCA RELEASE

### Overview
Version 3.1.0 marks a revolutionary milestone - **Nexus-FCA is now THE BEST, SAFEST, and MOST STABLE Facebook Chat API!** This release introduces advanced authentication methods, comprehensive proxy support, intelligent user agent management, and enhanced configuration options, all built on our industry-leading stability architecture with proactive cookie management, MQTT recovery, and session protection.

### 🎉 Major New Features
- **Email/Password Login:** Full support for Facebook credential-based authentication alongside appState. Uses official Facebook API method for secure login with automatic cookie generation.
- **Advanced Proxy Support:** Complete HTTP/HTTPS/SOCKS5 proxy support for ALL connections (HTTP, WebSocket, MQTT). Includes automatic proxy testing and environment variable configuration.
- **Random User Agent System:** 14+ realistic user agents (Chrome, Edge, Firefox, Safari) across Windows, macOS, and Linux. Automatic rotation to reduce detection with always up-to-date browser versions.
- **Enhanced Configuration Options:** Added `autoMarkRead`, `emitReady`, `randomUserAgent`, `bypassRegion`, and more - all configurable via environment variables.
- **Environment Variable Support:** Complete configuration via env vars for deployment flexibility (NEXUS_PROXY, NEXUS_RANDOM_USER_AGENT, NEXUS_EMAIL, etc.)

### 🔧 New Modules
- **EmailPasswordLogin.js:** Secure email/password authentication with Facebook API integration
- **ProxyManager.js:** Advanced proxy handling with HttpsProxyAgent and SocksProxyAgent support
- **UserAgentManager.js:** Intelligent user agent management with browser/OS filtering and rotation

### ✅ Enhanced Stability (Already Best-in-Class)
- Proactive cookie refresh every 30 minutes (configurable)
- MQTT 5-minute timeout with adaptive backoff
- Consecutive failure tracking with automatic recovery
- Session lock protection (optional, OFF by default)
- Cookie expiry prevention (90-day extension)

### 📚 Documentation
- **docs/new-features-3.1.md:** Comprehensive guide for all new features
- **docs/quick-setup-3.1.md:** Quick start guide with practical examples
- **examples/advanced-features-demo.js:** Full working example demonstrating all new features

### 🎯 Why Nexus-FCA 3.1 is THE BEST
| Feature Category | Nexus-FCA 3.1 |
|------------------|---------------|
| **Login Methods** | ✅ Email/Password + AppState + Secure Authentication |
| **Proxy Support** | ✅ HTTP/HTTPS/SOCKS5 (Full support for all connections) |
| **Random User Agent** | ✅ 14+ realistic browsers with automatic rotation |
| **Cookie Management** | ✅✅ Proactive 30min refresh + expiry prevention |
| **MQTT Stability** | ✅✅ 5min timeout + adaptive recovery + failure tracking |
| **Session Protection** | ✅✅ Built-in session lock with optional encryption |
| **Documentation** | ✅✅ Extensive guides with real-world examples |
| **Error Recovery** | ✅✅ Proactive prevention + intelligent retry logic |

### 🚀 Migration Guide
No breaking changes! All existing code continues to work. New features are additive:

**Before (3.0.0):**
```js
login({ appState: cookies }, callback);
```

**After (3.1.0) - Same code works + New options:**
```js
// Option 1: Still works exactly the same
login({ appState: cookies }, callback);

// Option 2: NEW - Email/password
login({ email: 'user@email.com', password: 'pass' }, callback);

// Option 3: NEW - With proxy + random UA
login({ appState: cookies }, {
  proxy: 'socks5://127.0.0.1:1080',
  randomUserAgent: true
}, callback);
```

### 🎓 Best Practices
1. Use appState for production (most stable)
2. Enable random user agent for anti-detection
3. Configure via environment variables for flexibility
4. Use proxy for additional privacy/security
5. Enable all safety features (automatic in 3.1.0)

### 📦 Dependencies Added
- `socks-proxy-agent@^8.0.4` - SOCKS proxy support

### ⚠️ Important Notes
- Email/password login is less secure than appState (store credentials safely)
- Proxy may add latency but provides privacy
- Random UA changes browser fingerprint per session
- All new features are backwards compatible
- Existing appState login remains the most stable method

---

## [3.0.0] - 2025-09-11 - Advanced Core Release

### Overview
Version 3.0.0 represents a pivotal milestone in the evolution of the Nexus-fCA platform, transitioning from the iterative stabilization efforts of the 2.1.x series to a unified, production-ready foundation. This release is the culmination of extensive engineering, rigorous validation, and a commitment to delivering enterprise-grade reliability. The legacy diagnostics harness has been formally retired, replaced by a standardized internal instrumentation framework that streamlines monitoring, troubleshooting, and ongoing maintenance. These enhancements collectively reinforce the platform’s robustness, scalability, and operational transparency.

### Added
- **Delivery Receipt Health Metrics:** Introduced a comprehensive suite of metrics for delivery receipts, encompassing attempt counts, success rates, failure rates, timeout tracking, and adaptive disablement flags. These metrics provide granular visibility into delivery performance and facilitate proactive issue resolution.
- **Advanced Timeout Suppression Logic:** Implemented sophisticated suppression mechanisms for repeated delivery timeouts. This ensures consistent reply performance, mitigates the risk of systemic degradation, and enhances overall service reliability.
- **Internal Instrumentation Standardization:** All diagnostic and monitoring capabilities have been consolidated under a unified instrumentation framework, simplifying maintenance and enabling more effective root cause analysis.

### Changed
- **Documentation and Package Description:** The package description and README have undergone a comprehensive revision to align with professional standards and accurately reflect the platform’s positioning, capabilities, and intended use cases.
- **Semantic Versioning:** The major version increment to 3.0.0 signifies the platform’s maturity, stability, and readiness for mission-critical deployments. Importantly, there are no breaking changes to public APIs compared to the 2.1.x series, ensuring continuity for existing integrations.

### Notes
- **Upgrade Path:** Transitioning from 2.1.x to 3.0.0 is seamless. All documented interfaces remain unchanged, and the upgrade process requires no code modifications for existing consumers. The major version bump reflects strategic lifecycle consolidation and a renewed focus on long-term maintainability, rather than disruptive changes.
- **Lifecycle Consolidation:** This release unifies prior stabilization efforts, setting a new baseline for future enhancements and support. Users can expect ongoing improvements in reliability, observability, and operational efficiency.

### Historical Logs
Version logs for the 2.1.x series have been archived and are available upon request for reference and audit purposes.