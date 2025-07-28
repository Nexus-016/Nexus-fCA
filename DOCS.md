# Nexus-FCA Documentation (2025 Edition)

> **Nexus-FCA is a next-generation, high-performance, developer-friendly Facebook Messenger bot framework.**

---

# 🆕 Version 2.0.2 — Nexus Login System & Ultra-Safe Automation

## 🚀 Major New Features
- **Nexus Login System**: Advanced, safe, and automatic Facebook login system (`/nexloginsystem`).
- **ID/Password/2FA Login**: Login directly with your Facebook username, password, and 2FA secret key (Google Authenticator supported).
- **Automatic Appstate Generation**: Instantly generate and save fresh appstate cookies—no browser/cookie extraction needed.
- **Seamless Bot Start**: After login, your bot starts automatically with the generated appstate.
- **Ultra-Safe Device Simulation**: Human-like Android device/user-agent simulation for maximum account safety.
- **Auto-Backup & Validation**: Appstate is auto-backed up and validated for every login.
- **Advanced Error Handling**: Smart retry, 2FA fallback, and detailed error messages.
- **Test File Included**: Test your login system easily with `/nexloginsystem/test-login.js`.
- **Full Documentation**: See `/nexloginsystem/README.md` for usage, API, and safety tips.

## ⚡ Quick Start (Nexus Login System)
```js
const { nexusLogin } = require('./nexloginsystem');
const result = await nexusLogin({
    username: 'your_email@gmail.com',
    password: 'your_password',
    twofactor: 'YOUR_2FA_SECRET_KEY'
});
if (result.success) {
    // Bot is ready! API available immediately
    result.api.sendMessage('Hello World!', result.api.getCurrentUserID());
}
```

- See `/nexloginsystem/README.md` for full API, advanced usage, and safety best practices.
- For 2FA setup, see the guide in the login system docs.

---

## 📋 Table of Contents
- [Enhanced Features](#enhanced-features)
- [Architecture Overview](#architecture-overview)
- [API Reference](#api-reference)
- [Migration & Compatibility](#migration--compatibility)
- [Advanced Usage](#advanced-usage)
- [Troubleshooting](#troubleshooting)
- [Community & Support](#community--support)

---

## 🚀 Enhanced Features
- **PerformanceManager**: Smart caching, metrics, and intelligent optimization
- **Advanced ErrorHandler**: Retry logic, circuit breaker, and fallback strategies
- **AdvancedMqttManager**: Auto-reconnect, heartbeat, and robust MQTT event handling
- **Safety System**: Ultra-low ban rate with intelligent human behavior simulation
- **Rich Message, Thread, User Classes**: Discord.js-style objects for easy, powerful bot logic
- **EnhancedDatabase**: Persistent, high-speed storage for sessions, users, threads, and history
- **Full TypeScript Support**: Modern, type-safe APIs and definitions
- **Modern Command & Middleware System**: Event-driven, modular, and extensible
- **Advanced MQTT Features**: Topic management, load balancing, and real-time monitoring
- **Professional Logging**: Clean, colorized, and filterable logs for all environments

---

## 🏗️ Architecture Overview
- **PerformanceManager**: `lib/performance/PerformanceManager.js`
- **ErrorHandler**: `lib/error/ErrorHandler.js`
- **AdvancedMqttManager**: `lib/mqtt/AdvancedMqttManager.js`
- **NexusClient**: `lib/compatibility/NexusClient.js`
- **CompatibilityLayer**: `lib/compatibility/CompatibilityLayer.js`
- **Message/Thread/User**: `lib/message/Message.js`, `Thread.js`, `User.js`
- **EnhancedDatabase**: `lib/database/EnhancedDatabase.js`

---

## 🛠️ API Reference

### Core Login
```js
const login = require("nexus-fca");
login({ appState: require("./appstate.json") }, (err, api) => { ... });
```

### Modern Client
```js
const { NexusClient } = require('nexus-fca');
const client = new NexusClient({ ...options });
client.on('ready', ...);
client.on('message', ...);
client.login({ appState: ... });
```

### PerformanceManager
- `getMetrics()` — Get real-time performance stats
- `setCache(key, value, ttl)` — Set cache with TTL
- `checkRateLimit(key, limit, window)` — Rate limiting

### ErrorHandler
- `retry(fn)` — Retry logic for async functions
- `setFallback(method, fn)` — Fallback strategies
- `getErrorStats()` — Error/circuit breaker stats

### AdvancedMqttManager
- `connect()` — Connect to MQTT
- `on('connected')` — Event for connection
- `startHeartbeat()` — Heartbeat monitoring

### EnhancedDatabase
- `saveUser(user)` — Save user data
- `getMessages(threadId, limit)` — Get message history
- `saveSession(session)` — Save session
- `logEvent(type, data)` — Log analytics/events

### CompatibilityLayer
- `createWrapper('fca-unofficial' | 'ws3-fca' | 'fca-utils')` — API compatibility
- `autoAdapt(api)` — Auto-adapt legacy API
- `createLegacyApi()` — Legacy API helpers

### Rich Message/Thread/User Objects
- `message.reply()`, `message.react()`, `message.edit()`, `message.forward()`, `message.pin()`, `message.markAsRead()`
- `thread.addUser()`, `thread.removeUser()`, `thread.changeName()`, `thread.getAdmins()`, `thread.makeAdmin()`
- `user.sendMessage()`, `user.block()`, `user.unblock()`, `user.getSharedThreads()`

---

## 🔄 Migration & Compatibility
- **fca-unofficial**: All methods supported, drop-in replacement
- **ws3-fca**: Compatible method names and event system
- **fca-utils**: Modern client API, command/middleware system
- **Migration helpers**: See `docs/Migration-fca-unofficial.md` for step-by-step guides

---

## 🧑‍💻 Advanced Usage

### Command System
```js
client.on('command', async ({ name, args, message }) => {
    if (name === 'ping') await message.reply('pong');
});
```

### Middleware
```js
client.use((message, next) => {
    // Custom logic
    next();
});
```

### Performance Monitoring
```js
const metrics = client.getMetrics();
console.log(metrics);
```

### Error Handling
```js
client.on('error', (err) => {
    console.error('Bot error:', err);
});
```

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
