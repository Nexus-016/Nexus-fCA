# Nexus-FCA v2.1.7

<!-- 2.1.7 Session Stability Patch -->
> New in 2.1.7: Session Stability Patch – anchored User-Agent continuity (eliminates 20–22h silent expiry pattern), lightweight mid‑session token poke (6h ±40m) + existing adaptive safeRefresh, retains ultra‑low ban profile.

<!-- 2.1.6 Memory Guard -->
> 2.1.6: Memory Guard & Queue Sweeping – bounded group queues, pending edit TTL sweeper, memory metrics exporter.

<!-- 2.1.5 PendingEdits -->
> 2.1.5: PendingEdits buffer (cap + TTL + safe resend), edit ACK watchdog, p95 ACK latency & edit resend/failure metrics, configurable via `api.setEditOptions()`.

<p align="center">
  <!-- Preview image wrapped in link (corrected ibb.co domain) -->
  <a href="https://ibb.co/8ymR1tw"><img src="https://i.ibb.co/Sk61FGg/Dragon-Fruit-1.jpg" alt="Nexus-FCA Dragon Fruit" width="520" border="0" /></a>
</p>

> Advanced, safe, modern Facebook Chat (Messenger) API with integrated secure login (ID / Password / 2FA), ultra‑low ban rate session management, adaptive MQTT resilience, memory guard, and TypeScript-ready developer experience.

---
## ✨ Highlights (Core Pillars)
- 🔐 Integrated secure login system (username/password + TOTP 2FA) → auto appstate
- 🛡️ Ultra-low ban rate design (human timing, safety limiter, anchored UA, risk heuristics)
- 🔄 Resilient MQTT listener (adaptive backoff + idle / ghost detection + periodic recycle)
- ♻️ Session continuity: anchored UA + adaptive safe refresh + lightweight mid-session poke
- 🧠 Smart session validation (lazy preflight, multi-endpoint retry, reduced false logouts)
- 📊 Live health & memory metrics (`api.getHealthMetrics()`, `api.getMemoryMetrics()`)
- 🧾 Type definitions (`index.d.ts`) & modern Promise / callback API
- 🧩 Modular architecture (safety, performance, error, mqtt managers)

---
## 🚀 Recent Stability Enhancements (2.1.7 / 2.1.6 / 2.1.5)
| Version | Focus | Key Additions |
|---------|-------|---------------|
| 2.1.7 | Session Longevity | UA continuity anchor, lightweight token poke, removal of mid-login UA drift |
| 2.1.6 | Memory Safety | Group queue idle purge + overflow trim, pendingEdits TTL sweeper, memory guard metrics |
| 2.1.5 | Edit Reliability | PendingEdits buffer (cap+TTL), ACK watchdog, resend limits, p95 ACK latency |

### Why UA Continuity Matters
Previously, dual-phase login could swap user agents (mobile → desktop) causing server-side heuristic expiry near 20–22h. Anchoring a single UA eliminates the inconsistent device fingerprint pattern and extends stable runtime under identical safety posture.

### Lightweight Mid-Session Poke
A subtle `fb_dtsg` refresh every ~6h ±40m (in addition to adaptive risk-based safeRefresh) keeps tokens warm without aggressive churn, lowering validation friction while avoiding noisy traffic patterns.

---
## 🧪 Key API Additions
```js
api.setEditOptions({ maxPendingEdits, editTTLms, ackTimeoutMs, maxResendAttempts });
api.setBackoffOptions({ base, factor, max, jitter });
api.enableLazyPreflight(true); // Skip heavy validation if a recent good connect exists
api.getHealthMetrics(); // uptime, reconnect stats, ack latency, synthetic keepalives
api.getMemoryMetrics(); // queue depths, drops, guard run counters
```

---
## 🔍 Monitoring Example
```js
setInterval(() => {
  const h = api.getHealthMetrics();
  const m = api.getMemoryMetrics();
  console.log('[HEALTH]', h?.status, 'acks', h?.ackCount, 'p95Ack', h?.p95AckLatencyMs);
  console.log('[MEM]', m);
}, 60000);
```

---
## 🧷 Long Session Best Practices
1. Use appstate login when possible (avoid frequent credential logins).
2. Keep `persistent-device.json` – do not rotate unless forced.
3. Avoid changing UA manually; continuity is automatic post‑2.1.7.
4. Inspect health metrics before manually forcing reconnects.
5. Let adaptive backoff handle transient network instability.

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
## 🛡️ Safety Layer (Updated)
| Feature | Benefit |
|---------|---------|
| Anchored User-Agent | Eliminates fingerprint drift (prevents 20–22h expiry) |
| Adaptive Safe Refresh | Risk‑sensitive token renewal bands |
| Lightweight Token Poke | Quiet longevity without churn |
| Idle / Ghost Detection | Auto probe + reconnect on silent stalls |
| Periodic Recycle | 6h ± jitter connection rejuvenation |
| Persistent Device Profile | Fewer checkpoints / trust continuity |
| Lazy Preflight | Skips heavy validation when recently healthy |
| Human-like Timing | Reduces automation signal surface |

Disable preflight if needed:
```js
await login({ appState }, { disablePreflight: true });
```

---
## 🛰️ MQTT Listener Enhancements
- Adaptive exponential backoff with jitter (caps 5m)
- Soft-stale probing (2m30s) + hard watchdog tiers
- Layered post-refresh health checks (1s / 10s / 30s) after token renewal
- Synthetic keepalives (randomized 55–75s) feeding metrics

---
## 📦 Example Echo Test
`examples/echo-test.js`:
```bash
node examples/echo-test.js
```
Provide `appstate.json` or set `EMAIL` / `PASSWORD` env variables.

---
## 🧠 Advanced Login Flow
1. Integrated system safely generates / refreshes cookies (if credentials supplied)
2. Core consumes resulting appstate for stable API behavior
3. Persistent device JSON: `persistent-device.json`

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
## 🔁 Updating from 2.0.x → 2.1.x
| Change | Action |
|--------|--------|
| UA Continuity (2.1.7) | No action; auto applied |
| Memory Guard (2.1.6) | Inspect `api.getMemoryMetrics()` periodically |
| PendingEdits (2.1.5) | Tune via `api.setEditOptions()` if needed |
| Lazy Preflight | Optionally disable when embedding in other frameworks |
| Persistent Device | Keep file unless forced reset required |

No breaking API changes across 2.1.x line.

---
## ⚠️ Disclaimer
This project is not affiliated with Facebook. Use responsibly. You are solely responsible for compliance with platform terms and local laws.

---
## 🤝 Contribute
PRs for safety, stability, perf, and updated GraphQL doc_ids welcome.

---
## 📜 License
MIT © 2025 Nexus-FCA Contributors
