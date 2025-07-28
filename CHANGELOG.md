# Changelog

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
