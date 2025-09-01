# Changelog

## [2.1.7] - 2025-09-01 - Session Stability Patch
### Added
- User-Agent continuity (anchored single UA for entire session via safety module; eliminates mid-session UA drift increasing 20–22h expiry risk).
- Exposed `setFixedUserAgent()` in `FacebookSafety` to allow explicit anchoring from credential phase.
- Mid-session lightweight token poke (6h ±40m) to keep session warm without full heavy refresh cycle.

### Changed
- Removed legacy mobile agent override fallback in `loginHelper` that caused mixed UA fingerprints.
- All safe requests now inherit continuity-aware UA through `applySafeRequestOptions`.

### Improved
- Extended resilience against 20–22h cookie invalidation observed with prior dual-phase UA pattern.
- Reduced unnecessary full refresh churn while preserving stealth (`safeRefresh` + light poke coexist).

---

## [2.1.6] - 2025-08-31 - Memory Guard & Queue Sweeping
### Added
- Central lightweight memory guard sweeps: group queue pruning (idle >30m, overflow trim) and pendingEdits TTL sweeper (every 4m).
- Health metrics extended: memoryGuardRuns, memoryGuardActions, groupQueueDroppedMessages, groupQueueExpiredQueues, groupQueuePrunedThreads, pendingEditSweeps.
- API: `api.getMemoryMetrics()` returns focused memory-related counters.
- Typings updated (`EditOptions`, new API methods) in `index.d.ts`.

### Improved
- Group queue now tracks `lastActive` and enforces idle purge + overflow protection with metrics.
- Pending edits TTL enforcement separated from resend watchdog for deterministic expiry.

### Notes
- All guards are low-frequency, low-impact; no change to delivery reliability or safety – only prevention of unbounded growth.

---

## [2.1.5] - 2025-08-28 - PendingEdits & ACK Metrics
### Added
- PendingEdits buffer with cap (default 200) + TTL (5m) + resend attempts (2) + ACK timeout (12s).
- Automatic edit resend watchdog with safe limits and metrics (editResends, editFailed, pendingEditsDropped, pendingEditsExpired).
- API: `api.setEditOptions({ maxPendingEdits, editTTLms, ackTimeoutMs, maxResendAttempts })`.
- Edit ACK integration: pending edit removed on ACK receipt.
- Health metrics: p95AckLatencyMs, editResends, editFailed.

### Improved
- Safer edit pipeline: prevents uncontrolled retries, bounds memory, tracks expirations.
- Enhanced HealthMetrics with percentile latency sample retention (50-sample window).

### Notes
- Durable outbound queue & metrics exporter planned next.

---

## [2.1.4] - Adaptive Backoff & Core Metrics
### Added
- Adaptive reconnect backoff with jitter (caps at 5 minutes) for safer, stealthier recovery loops.
- Lazy preflight session validation (skips heavy validation if a recent successful connect occurred) toggle via `api.enableLazyPreflight()`.
- Health metrics collector (uptime, idle time, reconnect counts, failures, message/ack counters, synthetic keepalives) accessible with `api.getHealthMetrics()` and included in `api.healthCheck()`.
- Randomized synthetic keepalive interval (55-75s) to reduce detection patterns.
- Backoff configuration hook: `api.setBackoffOptions()`.

### Improved
- Reduced noisy session validation on every `listenMqtt` invocation unless needed.
- More structured error classification feeding metrics (`session_invalid`, `timeout_no_t_ms`, `mqtt_error`, `message_parse`, `not_logged_in`).

### Planned (Next)
- ACK tracking refinement & resend logic.
- Pending edits buffer with TTL and cap.
- Durable outbound queue & health exporter.

---

## [2.1.2] - CONTINUOUS IDLE RECOVERY
### Added
- Soft-stale probing at 2 minutes idle (ping + conditional forced reconnect if no events within 5-8s)
- Wrapper around `listenMqtt` to automatically feed events into safety heartbeat (`recordEvent`) for precise idle detection
- Ghost connection detection (10m silent but socket connected triggers forced reconnect after probe)
- Periodic connection recycle every ~6h ±30m to prevent long-lived silent degradation
- Force reconnect API: `globalSafety.forceReconnect(tag)`

### Improved
- Faster recovery from silent idle states (previously required >5 min or external trigger)
- Reduced chance of appearing online but unresponsive after short inactivity
- Added keepalive foreground_state publishes each heartbeat

---

## [2.1.1] - 2025-08-27 - ADVANCED SESSION STABILITY
### 🛠 Added
- Adaptive safe session refresh interval (dynamic based on risk level)
- Heartbeat + watchdog timers to detect stale MQTT connections early
- Progressive backoff with jitter for MQTT reconnect attempts
- Layered post-refresh health checks (1s / 10s / 30s) to catch silent drops
- Abortable refresh with timeout safeguard (25s) to prevent hangs
- Automatic reconnection trigger if no events within thresholds (2m soft, 15m hard)
- `destroy()` method to cleanup timers/listeners (prevents memory leaks)

### 🔄 Changed
- Safe refresh now records in‑flight ID and supersedes outdated checks
- Reconnect logic centralized in `_reconnectMqttWithBackoff`

### ✅ Improved
- Stability after long runtimes / multiple token refresh cycles
- Reduced risk of listener not resuming after refresh

---

## [2.1.0] - 2025-08-20 - SESSION RELIABILITY & PROMISE LOGIN
### 🚀 Highlights
Stability-focused release improving long‑running bot sessions, reducing false `not_logged_in` events, and modernizing the login flow.

### Added
- ✅ Promise support for `login()` (dual callback + Promise API)
- 🆔 Persistent device fingerprint (saved to `persistent-device.json`) to reduce checkpoint / lock frequency
- 🛡️ New `validateSession()` multi-endpoint heuristic (lightweight, resilient preflight)
- ⚙️ New global option: `disablePreflight` (skip session validation if desired)
- 🔄 Structured error types from `parseAndCheckLogin` (`login_redirect`, `html_login_page`, `network_redirect`, etc.)
- 🧪 Example: `examples/echo-test.js` (Promise style, supports env credentials or appstate)

### Changed
- 🔁 `listenMqtt` now performs silent initial validation; only emits `not_logged_in` after a confirmatory retry
- 🧠 `parseAndCheckLogin` now robustly handles 3xx chains & HTML login fallback pages
- 🔐 Default behavior: device identity no longer rotates unless explicitly overridden
- 🧩 Refactored internal cookie & session utilities (centralized in `utils.js`)
- 📄 Rewritten documentation (README, DOCS, CHANGELOG) for concise modern onboarding

### Fixed
- ❌ Spurious `parseAndCheckLogin got status code: 302` fatal errors now classified & recovered when possible
- 💤 False negatives from legacy preflight removed (no premature `not_logged_in` during transient redirects)
- 🔄 Edge reconnect loop where MQTT closed before revalidation completed

### Migration Notes (2.0.x → 2.1.0)
- Existing code using callbacks continues to work. To use Promises: `const api = await login(opts);`
- If you previously depended on device rotation, disable persistent device via option (see README) or delete `persistent-device.json`.
- Remove any custom preflight hacks; built‑in `validateSession` supersedes them.

### Developer / Internal
- Centralized session validation pipeline
- Added granular error classification to aid future retry/backoff strategies
- Prepared foundation for upcoming metrics hooks in 2.2.x

---

## [2.0.5] - 2025-07-29 - FULLY INTEGRATED NPM EDITION
### 🎯 MAJOR: Full NPM Integration
- **✅ FULLY INTEGRATED**: Entire Nexus Login System now embedded directly in main `index.js`
- **📦 NPM COMPATIBLE**: Works perfectly when installed via `npm install nexus-fca` - no external folder dependencies
- **⚡ ZERO CONFIG**: Everything works out of the box - no separate folder setup required
- **🔄 SEAMLESS MIGRATION**: Existing code continues to work, new code benefits from integration

### Added
- 🎯 **Direct exports**: `nexusLogin` and `IntegratedNexusLoginSystem` available directly from main package
- 🧪 **Updated test files**: All test scripts now use integrated system (`require('nexus-fca')` instead of `./nexloginsystem`)
- 📖 **New documentation**: `npm-integration-guide.md` with complete NPM usage guide
- 🛠️ **NPM scripts**: Added `test:login`, `test:simple`, `test:2fa`, `test:all` for easy testing
- 📦 **Enhanced package.json**: Updated keywords, description, and version for NPM integration

### Changed
- 🏗️ **Architecture**: Moved entire Nexus Login System from external folder into main index.js (lines 372-860+)
- 📝 **Documentation**: Updated README.md to reflect NPM installation and integrated usage
- 🔧 **Test files**: Fixed all test imports to use main package instead of external folder
- 📦 **Package info**: Updated to v2.0.5 with new description highlighting NPM integration

### Fixed
- ❌ **NPM module errors**: Eliminated "Cannot find module './nexloginsystem'" when using as npm package
- 🔗 **Import paths**: All test files and examples now use correct import paths for npm usage
- 🎯 **Distribution**: Package now works identically whether used locally or installed via npm

## [2.0.4] - 2025-07-29
### Fixed
- 🐛 **Missing nexloginsystem folder**: Added `nexloginsystem/` to npm package files array to fix "Cannot find module './nexloginsystem'" error
- 🔄 **Legacy login fallback**: Added automatic fallback to appstate-only login when Nexus Login System is not available
- 🛡️ **Backward compatibility**: Enhanced compatibility for users using nexus-fca as npm dependency without full login system

### Changed
- Updated package.json to include nexloginsystem folder in published package
- Enhanced error handling with graceful fallback mechanisms

## [2.0.1] - 2025-07-28
### Added
- 🚀 **Nexus Login System**: Advanced, safe, and automatic Facebook login system added under `/nexloginsystem`.
- 🔐 **Appstate auto-generation**: Login with username/password/2FA, auto-save appstate, and seamless bot start.
- 🛡️ **Maximum safety**: Human-like device simulation, TOTP/2FA support, and advanced error handling.
- 📦 **Auto-backup & validation**: Appstate backup, validation, and lifecycle management.
- 📚 **Full documentation**: Usage, API, and safety docs in `/nexloginsystem/README.md`.

### Changed
- Updated main `README.md` with Nexus Login System quick start and features.

### Removed
- Old test files and legacy appstate generator scripts (now replaced by Nexus Login System).
