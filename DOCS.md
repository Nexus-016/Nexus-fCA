# Nexus-FCA Documentation (2025 Edition)

> Advanced, safe, high-performance Facebook Messenger automation with integrated secure login, ultra‑low ban rate protections, and modern modular architecture.

Quick links: [Configuration Reference](./docs/configuration-reference.md) · [Deployment Guide](./docs/deployment-config.md)

---
## 🆕 Version 2.1.0 – Session Stability & Safety Upgrade
**Key Enhancements**
- Persistent device fingerprint (prevents repeated “new device” flags)
- Smarter multi-endpoint session validation (`validateSession`) reducing false logouts
- Expanded redirect & HTML login detection in `parseAndCheckLogin`
- Promise support for `login()` (hybrid callback or async/await)
- Reduced noisy `not_logged_in` events (graceful preflight with retry)
- Option: `{ disablePreflight: true }` to bypass validation if needed

**Upgrade Guidance**: No breaking changes. Remove any custom wrappers previously used to promisify `login()`. If you filtered logs for substring “parseAndCheckLogin got status code”, consider switching to structured error `error.type`.

---
## ⚡ Quick Start
```js
const login = require('nexus-fca');
(async () => {
  const api = await login({ appState: require('./appstate.json') });
  api.listen((err, evt) => {
    if (err) return console.error(err);
    if (evt.body) api.sendMessage('Echo: ' + evt.body, evt.threadID);
  });
})();
```
**With Credentials + 2FA**
```js
const api = await login({ email: 'user@mail.com', password: 'pass', twofactor: 'TOTPSECRET' });
```

---
## 🔐 Session & Device Management
| Feature | Description | Config |
|---------|-------------|--------|
| Persistent Device | Reuses single profile (model, deviceId, UA) to reduce checkpoint triggers | Enabled by default (`persistentDeviceFile`) |
| Preflight Validation | Multi-endpoint test (www/m/mbasic) + cookie heuristic | Disable via `{ disablePreflight: true }` |
| Redirect Detection | Classifies `login_redirect`, `html_login_page` | Automatic |
| 5xx Retry | Up to 5 bounded randomized delays | Built-in |

---
## 🧠 Safety Layer Overview
Component | Purpose
--------- | -------
Safety Limiter | Human-like delays, action pacing
Session Guardian | Early logout & checkpoint detection
Persistent Device | Stable fingerprint across sessions
Error Classification | Structured types for automation logic

---
## 🛰️ MQTT Enhancements (2.1.0)
- Asynchronous preflight (no premature failure)
- Second-chance validation before emitting `not_logged_in`
- Better cookie reuse (no race on startup)

---
## API Quick Reference
### Core Login
```js
login({ appState }, (err, api) => { /* legacy style */ });
const api = await login({ email, password, twofactor });
```
### Listening
```js
api.listen((err, event) => { /* message / event objects */ });
```
### Sending
```js
api.sendMessage('Hi', threadID);
```
### Reactions / Typing
```js
api.setMessageReaction('❤', messageID, threadID, () => {});
api.sendTypingIndicator(threadID);
```
### Utilities
Exported via `require('nexus-fca').utils` including `validateSession`, formatting helpers, attachment normalization, safety utilities.

---
## Structured Error Types (Examples)
Type | Meaning
---- | -------
`login_redirect` | Server redirected to login/checkpoint
`html_login_page` | HTML login or checkpoint page received
`not_logged_in` | Verified invalid session after retry
`JSON.parse error.` | Unexpected non-JSON payload

Use in logic:
```js
api.listen((err) => {
  if (err && err.type === 'not_logged_in') {
    // Refresh appstate or alert
  }
});
```

---
## Migration (2.0.x → 2.1.0)
Old Behavior | New Behavior | Action
------------ | ------------ | ------
Random device each login | Persistent device | None (improves trust) |
Immediate preflight fail | Silent retry then classify | Adjust logging if needed |
Callback-only login | Promise + callback hybrid | Remove manual promisify |
Generic status code errors | Structured `error.type` fields | Update error filters |

---
## Troubleshooting
Issue | Suggestion
----- | ----------
False logout log | Ensure not disabling cookies; rely on new validation
Checkpoint after password login | Keep persistent device; avoid frequent password relogins; reuse appstate
Repeated 5xx retries | Inspect network / proxy; consider backoff strategy wrapper
No messages received | Verify MQTT topics, ensure `listen` not replaced by older code

---
## FAQ
Q: How to speed up without raising risk?  
A: Tune delay config in safety limiter; keep persistent device enabled; avoid burst sends.  
Q: Can I rotate devices manually?  
A: Delete `persistent-device.json` and re-run with `persistentDevice: true` for a new stable profile.  
Q: Disable safety layer for testing?  
A: Use `{ disablePreflight: true }` and adjust globalOptions, but not recommended in production.

---
## Disclaimer
Not affiliated with Facebook. Use at your own risk. Respect platform terms.

---
## Support & Contributing
- Issues / PRs: GitHub repository
- Focus areas: Safety updates, GraphQL doc_id refresh, performance, TypeScript types
