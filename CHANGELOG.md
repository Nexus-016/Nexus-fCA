# Changelog

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