#
# Changelog
#
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
