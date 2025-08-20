# Nexus-FCA v2.1.0

<p align="center">
  <!-- Preview image wrapped in link (corrected ibb.co domain) -->
  <a href="https://ibb.co/8ymR1tw"><img src="https://i.ibb.co/Sk61FGg/Dragon-Fruit-1.jpg" alt="Nexus-FCA Dragon Fruit" width="520" border="0" /></a>
</p>

> Advanced, safe, modern Facebook Chat (Messenger) API with integrated secure login (ID / Password / 2FA), ultra‑low ban rate session management, MQTT listener, and TypeScript-ready developer experience.

---
## ✨ Highlights
- 🔐 Integrated secure login system (username/password + TOTP 2FA) → auto appstate
- 🛡️ Ultra-low ban rate design (human timing, safety limiter, risk heuristics)
- 🔄 Resilient MQTT listener (improved session validation + graceful reconnect)
- 🔁 Persistent device fingerprint (no random rotation → fewer checkpoints)
- 🧠 Smart session validation (multi-endpoint retry, reduced false logouts)
- ⚙️ Zero-config appstate reuse & automatic backup/versioned snapshots
- 🧩 Modular architecture (safety, performance, error, mqtt managers)
- 🗂️ Rich feature docs in `/docs` (thread, message, reactions, attachments)
- 🧾 Type definitions (`index.d.ts`) & modern Promise / callback API

---
## 🚀 Install
```bash
npm install nexus-fca
```

---
## ⚡ Quick Start (Appstate)
```js
const login = require('nexus-fca');

(async () => {
  const api = await login({ appState: require('./appstate.json') });
  console.log('Logged in as', api.getCurrentUserID());
  api.listen((err, evt) => {
    if (err) return console.error('Listen error:', err);
    if (evt.body) api.sendMessage('Echo: ' + evt.body, evt.threadID);
  });
})();
```

## 🔐 Quick Start (Credentials + 2FA)
```js
const login = require('nexus-fca');

(async () => {
  const api = await login({
    email: process.env.FB_EMAIL,
    password: process.env.FB_PASS,
    twofactor: process.env.FB_2FA_SECRET // optional
  });
  api.listen((err, msg) => {
    if (err) return console.error(err);
    if (msg.body === 'ping') api.sendMessage('pong', msg.threadID);
  });
})();
```

---
## 🛡️ Safety Layer (v2.1.0 Improvements)
| Feature | Benefit |
|---------|---------|
| Persistent device profile | Prevents repeated “new device” flags & locks |
| Smarter session preflight | Eliminates noisy false `not_logged_in` errors |
| Redirect & HTML detection | Accurate login checkpoint identification |
| Controlled retries (5xx)  | Backoff without hammering endpoints |
| Human-like delays          | Reduces automated pattern detection |

Disable preflight if needed:
```js
await login({ appState }, { disablePreflight: true });
```

---
## 🛰️ MQTT Listener Enhancements
- Preflight now async & tolerant (second-stage check only logs failure)
- Classified errors: `login_redirect`, `html_login_page`, `not_logged_in`
- Automatic cookie/token refresh propagation

---
## 📦 Example Echo Test
`examples/echo-test.js` (already included):
```bash
node examples/echo-test.js
```
Provide `appstate.json` or set `EMAIL` / `PASSWORD` env variables.

---
## 🧠 Advanced Login Flow
1. New integrated system safely generates / refreshes cookies (if credentials supplied)
2. Legacy core consumes resulting appstate for stable API behavior
3. Optional persistent device JSON: `persistent-device.json`

Persistent device toggle:
```js
const { IntegratedNexusLoginSystem } = require('nexus-fca');
new IntegratedNexusLoginSystem({ persistentDevice: true });
```

---
## 🐐 Using Nexus-FCA with GoatBot V2
Nexus-FCA can act as a drop‑in enhancement for the legacy fb-chat-api layer inside GoatBot V2.

### Option 1: Non‑invasive (generate fresh appstate)
1. In a separate script, run Nexus-FCA credential login (with 2FA if needed):
```js
const login = require('nexus-fca');
(async () => {
  const api = await login({ email: process.env.FB_EMAIL, password: process.env.FB_PASS, twofactor: process.env.FB_2FA });
  const appState = api.getAppState();
  require('fs').writeFileSync('./appstate.json', JSON.stringify(appState, null, 2));
  console.log('Saved appstate.json');
})();
```
2. Configure GoatBot to use that `appstate.json` (no credential scraping needed).
3. Repeat only when session truly expires (persistent device reduces frequency).

### Option 2: Replace internal fb-chat-api
GoatBot has a local `fb-chat-api` folder. To leverage Nexus-FCA improvements globally:
1. Install Nexus-FCA inside GoatBot project:
```bash
npm install nexus-fca
```
2. Rename GoatBot’s original folder for backup:
```bash
mv fb-chat-api fb-chat-api.orig   # (Windows: rename manually)
```
3. Create a shim folder `fb-chat-api/index.js` with:
```js
module.exports = require('nexus-fca');
```
4. Start GoatBot normally. All calls (`login`, `api.listen`, send methods) now use Nexus-FCA (Promise supported).

### Option 3: Direct require patch
Search GoatBot source for `require("fb-chat-api")` and change to `require("nexus-fca")`.

### Promise usage inside GoatBot scripts
Replace:
```js
fbapi(loginData, (err, api) => { ... });
```
with:
```js
const login = require('nexus-fca');
const api = await login(loginData); // supports { appState } or { email, password, twofactor }
```

### Recommended settings
- Keep `persistent-device.json` at project root so repeated restarts reuse the same fingerprint.
- If GoatBot already performs its own “live cookie check” loops, you can set `{ disablePreflight: true }` to avoid duplicate validation.
- Handle reconnect events: listen for `error` and `listen` callbacks just like original; classified errors now have `error.type` (`login_redirect`, etc.).

### Minimal integration example
```js
const login = require('nexus-fca');
(async () => {
  const api = await login({ appState: require('./appstate.json') });
  api.listen(async (err, event) => {
    if (err) return console.error('[Nexus-FCA]', err);
    if (event.body === '!ping') api.sendMessage('pong', event.threadID);
  });
})();
```

---
## 📚 Documentation
- Full API reference: `DOCS.md`
- Per-feature guides: `/docs/*.md`
- Safety: `docs/account-safety.md`
- Examples: `/examples`

---
## 🔁 Updating from 2.0.x → 2.1.0
| Change | Action |
|--------|--------|
| Preflight errors | Noise reduced automatically |
| Device rotation | Now persistent by default | 
| parseAndCheckLogin | Handles 3xx & HTML login responses |
| Session validation | New `validateSession` helper |

No breaking API changes.

---
## ⚠️ Disclaimer
This project is not affiliated with Facebook. Use responsibly. You are solely responsible for compliance with platform terms and local laws.

---
## 🤝 Contribute
PRs for safety, stability, perf, and updated GraphQL doc_ids welcome.

---
## 📜 License
MIT © 2025 Nexus-FCA Contributors
