# Changelog

## [4.4.0] - 2026-11-12 - 🛡️ PRODUCTION HARDENING + DEPS MODERNIZATION
- **UA fingerprint lock**: one stable Chrome/141 UA per session — login = HTTP headers = MQTT = cookie check all share it (seeded from `globalOptions.userAgent`), stored in `Fca_Database/safety_store.json` (stale-version UAs rejected on load).
- **Login-time dead-cookie detection**: expired cookies caught in `LoginManager` before MQTT start; typed lock patterns (checkpoint / unusual_activity / account_locked / verification_required / login_approval / `cookie_invalid`) with patient retry backoff 15→30→60 min that re-reads `appstate.json` — never a hot `process.exit`.
- **CookieRefresher actually runs**: `appStatePath` wired through, first refresh delayed 2–4 min after login, sessionGuard skips unchanged state, `getAppState` dedupes duplicate cookies (linux/windows platform hints fixed).
- **Massive-load protections**: per-thread group queue (cap 100, 3 parallel) with deadlock-proof `processQueue` (sync throws can no longer strand the queue), `_pendingOutbound` TTL sweep (3 min) + 1000 cap, circuit breaker wired through the callback path, `smartSafetyLimiter` per-user session pruning, bounded ack-latency samples, editSettings maxPendingEdits cap.
- **sqlite hardening**: WAL + `busy_timeout 5000` on every database, 24h metrics retention.
- **Dependencies modernized**: mqtt 4→5.16.1 (live-tested MQIsdp/3 + custom `wsOptions` headers over WS), uuid 9→11.1 (last require()-compatible major), ws 8.22.2, cheerio/axios pinned current, tough-cookie/jar-support aligned to runtime-proven 5.x; `engines >= 20`.
- Console noise removed: per-send MQTT payload dumps now gated behind `NEXUS_VERBOSE_MQTT=1`.

## [4.3.1] - 2026-10-16 - 🎨 AI THEME ENDPOINT FIX
- Root cause of `field_exception 1675030`: AI generation mutation only resolves on `web.facebook.com` - `www.facebook.com` returns null data. Matches nkxfca implementation.
- `createThemeAI`: posts to `web.facebook.com/api/graphql/`, form aligned with nkxfca (`qpl_active_flow_ids`, analytics tags, `i_userID` actor, `fb_dtsg`, `client_mutation_id: "1"`).
- Console cleanup: no more full-response dump on success; short error line only (full err still goes to caller).

## [4.3.0] - 2026-10-16 - 📦 E2EE + STORY + STICKERS + FALLBACK (toru/nkxfca ports)
- **E2EE bridge (opt-in, off by default)**: `e2ee.js` + `lib/e2ee/index.mjs` (Labyrinth bundle, credits toru/alpha-fca), `src/e2eeBridge.js` wiring: `api.connectE2EE(cb)`, `api.getE2EEBridge()`, `api.getE2EEDeviceData(cb)`. E2EE routes added to `setMessageReaction` + `sendTypingIndicator` (guarded, fall through when off). Enable: login `{ enableE2EE: true }` + `npm i koffi yumi-json-bigint` + Labyrinth native binary. Status: BETA - needs live secret-chat test.
- **storyManager**: `api.storyManager({action:'add'|'upload'|'delete'|'check', attachment, storyID})` - story create/delete/list.
- **stickerStore**: `api.stickerStore.{search, listPacks, getStorePacks, listAllPacks, addPack, getStickersInPack, getAiStickers}` (credits @ChoruOfficial/nkxfca). `searchStickers` untouched.
- **OldMessage fallback**: `api.OldMessage(msg, threadID)` - legacy HTTP `messaging/send/` path when MQTT send fails.
- **AI theme upgrade**: `api.createThemeAI(prompt, numThemes?)` now supports up to 10 themes + returns `allThemes` (mutation already current).

## [4.2.0] - 2026-10-16 - 🛡️ SAFEST ROUND (ws3-fca/nkxfca patterns)
- **Fingerprint lock** (biggest fix): `utils.getHeaders` used to rotate UA+ClientHints on EVERY request - a bot signal no real browser ever gives. Now one UA locked per session (`ctx._fpLocked`). Opt-out: `fingerprintLock:false`. ws3-compat: `randomUserAgent:false` + `userAgent` string = fixed UA. `getHeaders`/`hintsForUA` exported for tests.
- **Randomized fb_dtsg refresh**: fixed 20min -> random 15-25min each cycle (override: `fbDtsgRefreshMs` fixed, `fbDtsgRefreshJitter:false`).
- **Send circuit breaker (light)**: 5 consecutive spam/block/checkpoint/rate-limit/restrict failures -> 5min cooldown with 30s slow sends. Resets on success.
- ws3-fca surveyed (1,852 weekly dl, biggest FCA): its `randomUserAgent:false` option confirms fingerprint-lock approach. No new messaging APIs worth porting there (pin/typing/stickers/pools already covered).

## [4.1.1] - 2026-10-16 - ⌨️ TYPING INDICATOR FIX
- Root cause: `sendTypingIndicator` used dead HTTP endpoint `ajax/messaging/typ.php` (mercury-chat, removed by FB years ago) - typing never showed.
- Fix (from toru-fca v1.1.0): publish MQTT `/ls_req` type-4 label-3 with shared `ctx.wsReqNumber`. MQTT down = silent skip (cosmetic only).
- Dual signature: NEW `api.sendTypingIndicator(true, threadID)` + OLD `api.sendTypingIndicator(threadID)` (returns `end()` to stop) - `Thread.startTyping()` keeps working.

## [4.1.0] - 2026-10-16 - 🆕 NEW + UPDATED APIs (ported from toru-fca/dongdev)

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
- `setMessageReaction` - doc_id `1491398900900362` toru/fca-riyad এর সাথে same, E2EE route আগেই আছে
- `pinMessage` - pin + unpin দুটোই support করে

### Deferred (পরে)
- AI theme generate + AI sticker pack, E2EE bridge, storyManager, OldMessage fallback, auto-update checker

## [4.0.0] - 2026-10-16 - 🏆 MOST ADVANCED MERGE (best of sahu/dongdev/toru/mostakim)

### Merged best practices from online FCAs
- **toru-fca**: anti-logout guard (`logout` blocked, `forceLogout`/`stopAntiLogout`), `sessionGuard` auto-save every 3min + `saveSession`, `fb_dtsg` auto-refresh every 20min (was 24h), `humanLikeDelay` 50-200ms, `facebookProtection` option, `getHealth()` snapshot
- **sahu-fca**: adaptive rate-limit intact + `refreshFcaConfig()` runtime reload, domain-compat aliases
- **dongdev**: LSD/spin/jazoest/hsi extraction + `X-Fb-Lsd` headers fixed (ctx.lsd was never set - bug), expanded DTSG regex, JSON-script fallback kept
- **mostakim**: E2EE-ready structure note + auto-update check pattern (manual `npm i nexus-fca@latest`)
- **MQTT 24h**: `MqttManager` infinite reconnect (was max 10), max delay 30s -> 5min + jitter, factor 1.5

### Fixed
- `user-agents.js`: Chrome 131-133 -> 139-141 (Oct 2026 stable), added Linux, `windowsUserAgent` export for GoatBot compat
- `setOptions` default UA Chrome 131 -> 141
- `ctx.lsd`/`ctx.master`/`ctx.jazoest` now populated so `utils.getHeaders` sends real `X-Fb-Lsd`/`X-Fb-Spin-*`
- `sendTypingIndicatorV2` alias for toru-compat, `fbDtsgRefreshMs` configurable via globalOptions

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
// Maximum Speed (like fca-unofficial)
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