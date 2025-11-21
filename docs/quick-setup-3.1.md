# 🚀 Nexus-FCA 3.1 - Quick Setup Guide

## 📦 Installation

```bash
npm install nexus-fca@latest

# or install dependencies for new features
npm install https-proxy-agent socks-proxy-agent
```

## ⚡ 5-Minute Quick Start

### 1. Basic AppState Login (Most Stable)

```javascript
const login = require('nexus-fca');
const fs = require('fs');

const appState = JSON.parse(fs.readFileSync('appstate.json', 'utf8'));

login({ appState }, (err, api) => {
    if (err) return console.error(err);
    console.log('✅ Logged in!');
    
    api.listen((err, message) => {
        if (err) return console.error(err);
        if (message.body) {
            api.sendMessage(`Echo: ${message.body}`, message.threadID);
        }
    });
});
```

### 2. Email/Password Login (NEW!)

```javascript
const login = require('nexus-fca');

login({
    email: 'your-email@example.com',
    password: 'your-password'
}, {
    autoReconnect: true
}, (err, api) => {
    if (err) return console.error(err);
    console.log('✅ Logged in with email/password!');
    
    api.listen((err, message) => {
        if (err) return console.error(err);
        console.log('Message:', message.body);
    });
});
```

### 3. With All New Features

```javascript
const login = require('nexus-fca');

login({ appState: require('./appstate.json') }, {
    // Network features
    proxy: 'socks5://127.0.0.1:1080',  // Proxy support
    randomUserAgent: true,              // Random UA
    
    // Bot options
    autoMarkRead: true,                 // Auto mark read
    emitReady: true,                    // Ready event
    online: true,
    autoReconnect: true
}, (err, api) => {
    if (err) return console.error(err);
    
    api.on('ready', () => {
        console.log('🚀 Bot is ready!');
    });
    
    api.listen((err, message) => {
        if (err) return console.error(err);
        api.sendMessage('Hi!', message.threadID);
    });
});
```

## 🔧 Environment Variables Setup

Create a `.env` file (use with `dotenv` package):

```bash
# Authentication
NEXUS_EMAIL=your-email@example.com
NEXUS_PASSWORD=your-password

# Network
NEXUS_PROXY=socks5://127.0.0.1:1080
NEXUS_RANDOM_USER_AGENT=true
NEXUS_USER_AGENT=custom-user-agent

# Bot Configuration
NEXUS_ONLINE=true
NEXUS_BYPASS_REGION=PRN

# Session
NEXUS_SESSION_LOCK_ENABLED=false

# Cookie Management (automatic)
NEXUS_COOKIE_REFRESH_ENABLED=true
NEXUS_COOKIE_REFRESH_INTERVAL=1800000
NEXUS_COOKIE_EXPIRY_DAYS=90

# MQTT Stability (automatic)
NEXUS_MQTT_TIMEOUT=300000
NEXUS_MQTT_MIN_BACKOFF=1000
NEXUS_MQTT_MAX_BACKOFF=300000
```

Then use in code:

```javascript
require('dotenv').config();
const login = require('nexus-fca');

login({
    email: process.env.NEXUS_EMAIL,
    password: process.env.NEXUS_PASSWORD
}, {
    proxy: process.env.NEXUS_PROXY,
    randomUserAgent: process.env.NEXUS_RANDOM_USER_AGENT === 'true'
}, callback);
```

## 📋 Feature Comparison Table

| Feature | Command/Option | Default | Environment Variable |
|---------|---------------|---------|---------------------|
| **Email/Password Login** | `{ email, password }` | - | `NEXUS_EMAIL`, `NEXUS_PASSWORD` |
| **Proxy Support** | `{ proxy: 'url' }` | none | `NEXUS_PROXY`, `HTTP_PROXY` |
| **Random User Agent** | `{ randomUserAgent: true }` | false | `NEXUS_RANDOM_USER_AGENT` |
| **Auto Mark Read** | `{ autoMarkRead: true }` | false | - |
| **Emit Ready** | `{ emitReady: true }` | false | - |
| **Bypass Region** | `{ bypassRegion: 'PRN' }` | auto | `NEXUS_BYPASS_REGION` |
| **Cookie Refresh** | automatic | 30min | `NEXUS_COOKIE_REFRESH_INTERVAL` |
| **MQTT Timeout** | automatic | 5min | `NEXUS_MQTT_TIMEOUT` |
| **Session Lock** | automatic | OFF | `NEXUS_SESSION_LOCK_ENABLED` |

## 🎯 Common Use Cases

### Use Case 1: Development Bot (Quick Testing)
```javascript
login({
    email: 'test@example.com',
    password: 'testpass'
}, {
    autoReconnect: true,
    randomUserAgent: true
}, callback);
```

### Use Case 2: Production Bot (Most Stable)
```javascript
login({ 
    appState: require('./appstate.json') 
}, {
    autoReconnect: true,
    forceLogin: true,
    online: true
}, callback);
```

### Use Case 3: Behind Proxy (Privacy/Security)
```javascript
login({ appState: require('./appstate.json') }, {
    proxy: 'socks5://127.0.0.1:1080',
    randomUserAgent: true,
    autoReconnect: true
}, callback);
```

### Use Case 4: Maximum Stability
```javascript
// All stability features are automatic!
login({ appState: require('./appstate.json') }, {
    autoReconnect: true,
    forceLogin: true
}, callback);

// Nexus-FCA automatically:
// ✅ Refreshes cookies every 30 minutes
// ✅ Extends cookie expiry to 90 days
// ✅ MQTT 5-minute timeout with recovery
// ✅ Tracks consecutive failures
// ✅ Proactive cookie refresh after 10 failures
// ✅ Session protection (if enabled)
```

## 🔍 Testing New Features

### Test Email/Password Login
```javascript
const { EmailPasswordLogin } = require('nexus-fca');
const utils = require('nexus-fca/utils');

const emailLogin = new EmailPasswordLogin();
const jar = utils.getJar();

emailLogin.login('your-email', 'your-password', jar)
    .then(result => {
        console.log('✅ Login successful!');
        console.log('UID:', result.uid);
    })
    .catch(err => {
        console.error('❌ Login failed:', err.message);
    });
```

### Test Proxy
```javascript
const { ProxyManager } = require('nexus-fca');

const proxy = new ProxyManager('http://proxy.example.com:8080');

proxy.testProxy().then(working => {
    if (working) {
        console.log('✅ Proxy working!');
    } else {
        console.error('❌ Proxy failed');
    }
});

console.log(proxy.getInfo());
// { enabled: true, type: 'http', host: 'proxy.example.com', port: '8080' }
```

### Test Random User Agent
```javascript
const { UserAgentManager } = require('nexus-fca');

const uaManager = new UserAgentManager({ random: true });

console.log('User Agent:', uaManager.getUserAgent());
console.log('Info:', uaManager.getInfo());
// { browser: 'Chrome', os: 'Windows', version: '131', randomEnabled: true }

console.log('Available Browsers:', uaManager.getAvailableBrowsers());
// ['Chrome', 'Edge', 'Firefox', 'Safari']

console.log('Available OS:', uaManager.getAvailableOS());
// ['Windows', 'macOS', 'Linux']
```

## 🐛 Troubleshooting

### Email/Password Login Fails
```
Error: Invalid email or password
```
**Solution:** Check credentials, ensure account is not locked

### Proxy Connection Error
```
Error: Proxy test failed
```
**Solution:** 
1. Test proxy with curl: `curl -x socks5://127.0.0.1:1080 https://www.facebook.com`
2. Check proxy is running
3. Verify proxy URL format

### Random UA Not Working
```
Warning: Random user agent is disabled
```
**Solution:** Set `randomUserAgent: true` in options or `NEXUS_RANDOM_USER_AGENT=true`

## 📚 Documentation

- **Full Features Guide:** [docs/new-features-3.1.md](./new-features-3.1.md)
- **Advanced Configuration:** [docs/advanced-configuration.md](./advanced-configuration.md)
- **MQTT Stability:** [docs/mqtt-stability-guide.md](./mqtt-stability-guide.md)
- **Full Example:** [examples/advanced-features-demo.js](../examples/advanced-features-demo.js)

## 🎉 What Makes Nexus-FCA 3.1 THE BEST?

✅ **Most Features** - Email/password, proxy, random UA, + all existing features  
✅ **Most Stable** - Proactive cookie refresh, MQTT recovery, error handling  
✅ **Most Safe** - Session lock, cookie management, anti-detection  
✅ **Best Documentation** - Comprehensive guides with real-world examples  
✅ **Industry-Leading** - Advanced features with proven stability architecture!

---

**Need Help?**
- GitHub Issues: https://github.com/Nexus-016/Nexus-fCA/issues
- Examples: `examples/` folder
- Full Docs: `docs/` folder

**Happy Coding! 🚀**
