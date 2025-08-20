# Changelog

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
