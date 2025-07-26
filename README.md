<div align="center">

<img src="https://i.ibb.co/LzkQMGWz/Future-Studio-Synthwave-Logo-Future-Studio-Synthwave-Logo.png" alt="Nexus-FCA Logo" width="500"/>

</div>

# Nexus-FCA (2.0.0)

> **A next-generation, high-performance, developer-friendly Facebook Messenger bot framework.**

---

## 🚀 What's New in 2.0.0
- **PerformanceManager**: Smart caching, metrics, and rate limiting for blazing speed.
- **Advanced ErrorHandler**: Retry logic, circuit breaker, and fallback strategies for robust bots.
- **AdvancedMqttManager**: Auto-reconnect, heartbeat, and stable MQTT event handling.
- **API Compatibility Layer**: Drop-in support for fca-unofficial, ws3-fca, and fca-utils codebases.
- **Rich Message, Thread, User Classes**: Discord.js-style objects for easy, powerful bot logic.
- **EnhancedDatabase**: Persistent, high-speed storage for sessions, users, threads, and history.
- **Full TypeScript Support**: Modern, type-safe APIs and definitions.
- **Modern Command & Middleware System**: Event-driven, modular, and extensible.
- **Advanced MQTT Features**: Topic management, load balancing, and real-time monitoring.
- **Professional Logging**: Clean, colorized, and filterable logs for all environments.

---

## 🖼️ Demo

<div align="center">
  <img src="https://i.ibb.co/FbCSF0Pj/Capture.png" alt="Nexus-FCA Demo Screenshot" width="700"/>
</div>

---

## ✨ Key Features
- **Modern, Safe, and Actively Maintained**
- **No WebView/Browser Automation**
- **No CAPTCHA/Verification Required**
- **All Major Messenger Features**
- **Admin & Safety Tools**
- **Easy Login with `appstate.json`**
- **Full Documentation & Migration Guides**

---

## 📦 Installation
```bash
npm install nexus-fca
```

---

## 🛠️ Quick Start Example
```js
const login = require("nexus-fca");

login({ appState: require("./appstate.json") }, (err, api) => {
    if (err) return console.error("Login error:", err);
    api.listenMqtt((err, event) => {
        if (err) return console.error("Listen error:", err);
        if (event.body && event.threadID) {
            api.sendMessage("Echo: " + event.body, event.threadID);
        }
    });
});
```

---

## 🧑‍💻 Modern Client Example (Recommended)
```js
const { NexusClient } = require('nexus-fca');

const client = new NexusClient({
    prefix: '!',
    rateLimitEnabled: true,
    performanceOptimization: true,
    cachingEnabled: true,
    logLevel: 'info'
});

client.on('ready', (api, userID) => {
    console.log(`✅ Ready as ${userID}`);
});

client.on('message', async (message) => {
    if (message.body === 'ping') await message.reply('🏓 Pong!');
});

client.login({ appState: require('./appstate.json') });
```

---

## 🏗️ Architecture Overview
- **lib/performance/PerformanceManager.js**: Caching, metrics, rate limiting
- **lib/error/ErrorHandler.js**: Retry, circuit breaker, fallback
- **lib/mqtt/AdvancedMqttManager.js**: Robust MQTT connection
- **lib/compatibility/NexusClient.js**: Modern API, command system, middleware
- **lib/message/Message.js, Thread.js, User.js**: Rich object models
- **lib/database/EnhancedDatabase.js**: Persistent, high-speed storage
- **lib/compatibility/CompatibilityLayer.js**: API migration and compatibility

---

## 🔄 Migration & Compatibility
- **fca-unofficial**: Drop-in replacement, all methods supported
- **ws3-fca**: Compatible method names and event system
- **fca-utils**: Modern client API, command/middleware system
- **Migration helpers**: See `docs/Migration-fca-unofficial.md` for step-by-step guides

---

## 📝 Advanced Features
- **PerformanceManager**: `getMetrics()`, `setCache()`, `checkRateLimit()`
- **ErrorHandler**: `retry()`, `setFallback()`, `getErrorStats()`
- **AdvancedMqttManager**: `connect()`, `on('connected')`, `startHeartbeat()`
- **EnhancedDatabase**: `saveUser()`, `getMessages()`, `saveSession()`, `logEvent()`
- **CompatibilityLayer**: `createWrapper()`, `autoAdapt()`, `createLegacyApi()`
- **Rich Message Objects**: `reply()`, `react()`, `edit()`, `forward()`, `pin()`, `markAsRead()`
- **Thread/User Objects**: `addUser()`, `removeUser()`, `changeName()`, `getAdmins()`, `makeAdmin()`

---

## 📚 Documentation & Guides
- **Full API Reference**: See [`DOCS.md`](./DOCS.md)
- **Migration Guides**: See [`docs/`](./docs/) for fca-unofficial, ws3-fca, fca-utils
- **TypeScript Usage**: Complete types in [`index.d.ts`](./index.d.ts)
- **Performance & Error Handling**: See advanced sections in docs

---

## 🛡️ Troubleshooting
- **MQTT Connection Refused**: Check your `appstate.json`, resolve Facebook checkpoints, or try a new account.
- **TypeScript Errors**: Ensure you are using the latest `index.d.ts` and TypeScript version.
- **Other Issues**: See logs, check for updates, or open an issue on GitHub.

---

## 💬 Community & Support
- **GitHub**: [github.com/Nexus-016/Nexus-fCA](https://github.com/Nexus-016/Nexus-fCA)
- **Docs**: See `/docs` for per-feature usage and migration
- **Contributions**: PRs and issues welcome!

---

## ⚠️ Disclaimer
Nexus-FCA is not affiliated with Facebook. Use responsibly and at your own risk. Automation may violate Facebook’s terms of service.
