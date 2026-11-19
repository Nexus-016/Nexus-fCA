# Deployment & Configuration Guide (Nexus-FCA 3.0)

This guide shows how to use Nexus-FCA as an npm package, configure it via file and environment variables, deploy safely on platforms like Render, and avoid the “you couldn't create multiple sessions” warning.

---
## 1) Using as an npm package

Install:

```bash
npm install nexus-fca
```

Basic appstate usage:

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

---
## 2) Configuration options

You can control behavior via:
- Programmatic options: `api.setOptions({ ... })`
- Config file: `fca-config.json` (auto-created on first run)
- Environment variables (recommended for hosting)

### 2.1 Programmatic options (common)
```js
api.setOptions({
  autoReconnect: true,
  updatePresence: false,
  selfListen: false,
  logLevel: 'warn',           // npmlog level: silly|verbose|info|warn|error
  userAgent: '...Chrome/...',
  proxy: 'http://user:pass@host:port',
});
```

### 2.2 Config file: `fca-config.json`
On first run the full template is written to the project root. It covers every
programmatic option plus the safety/network/MQTT/autoLogin/vault groups. Use
`preset` to pick the speed/safety trade-off and override individual knobs:

| Preset    | Behaviour |
|-----------|-----------|
| `safety`  | Default. 1.2–2.5 s send pacing + every keep-alive check. |
| `ultra`   | Very slow / maximum protection. 2.5–5 s pacing, ultra-low-ban mode. |
| `nexflash`| Safe keep-alive features kept, sends near-instant (0–120 ms). |
| `none`    | No safety shaping: no delays, no headers, no background timers. |

```json
{
  "preset": "safety",
  "autoUpdate": false,
  "autoLogin": false,
  "credentials": { "email": "", "password": "", "twofactor": "" },
  "options": { "online": true, "selfListen": false, "autoReconnect": true, "logLevel": "info" },
  "network": { "proxy": "", "userAgent": "", "acceptLanguage": "en-US,en;q=0.9" },
  "mqtt": { "enabled": true, "reconnectInterval": 3600, "lsSendTimeoutMs": 15000 },
  "safety": { "enabled": null, "sendDelay": { "min": null, "max": null }, "...": null },
  "attachments": { "uploadField": "farr", "uploadRetries": 3, "uploadRetryDelayMs": 2000 },
  "sessionVault": { "url": "", "token": "", "method": "", "prefer": "vault" }
}
```

`null` inside `safety` inherits the preset; a concrete value overrides it.
Legacy minimal configs keep working (they receive the `safety` defaults).

Note: For secrets and deployment toggles, prefer environment variables below.

### 2.3 Environment variables (hosting-friendly)
These are read at runtime and override defaults:

- Storage & persistence
  - `NEXUS_DATA_DIR` → base directory for persistent files
  - `NEXUS_APPSTATE_PATH` → path to `appstate.json`
  - `NEXUS_DEVICE_FILE` → path to `persistent-device.json`
  - `NEXUS_BACKUP_PATH` → directory for appstate backups
  - `NEXUS_PERSISTENT_DEVICE` → `true|false` (keep same device fingerprint)

- Session vault (Koyeb/Render/Railway)
  - `NEXUS_SESSION_VAULT_URL` → HTTP store for the freshest session
  - `NEXUS_SESSION_VAULT_TOKEN` → Bearer token / jsonbin key
  - `NEXUS_SESSION_VAULT_METHOD` → `PUT` or `POST`
  - `NEXUS_SESSION_VAULT_PREFER=env` → always use `APPSTATE_JSON` instead of
    restoring the vault copy (debug escape hatch)

- Networking & headers
  - `NEXUS_PROXY` (or `HTTPS_PROXY` / `HTTP_PROXY`) → Proxy URL
  - `NEXUS_ACCEPT_LANGUAGE` → e.g. `en-US,en;q=0.9`
  - `NEXUS_UA` → override User-Agent
  - `NEXUS_REGION` → force MQTT region (e.g., `HIL`)

- Stability & preflight
  - `NEXUS_DISABLE_PREFLIGHT` → `true|false` (skip heavy session preflight)
  - `NEXUS_ONLINE` → `true|false`
  - `NEXUS_VERBOSE_MQTT` → `true|false` (extra MQTT logs only when needed)

Example (Render):
```
NEXUS_DATA_DIR=/var/data/nexus-fca
NEXUS_APPSTATE_PATH=/var/data/nexus-fca/appstate.json
NEXUS_DEVICE_FILE=/var/data/nexus-fca/persistent-device.json
NEXUS_BACKUP_PATH=/var/data/nexus-fca/backups
NEXUS_PERSISTENT_DEVICE=true

NEXUS_ACCEPT_LANGUAGE=en-US,en;q=0.9
NEXUS_UA=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36
NEXUS_DISABLE_PREFLIGHT=true
NEXUS_ONLINE=false
# Optional region & proxy
# NEXUS_REGION=HIL
# NEXUS_PROXY=http://user:pass@host:port
```

---
## 3) Deploying on Render (or other PaaS)

1) Persistent disk
- Mount a disk and point `NEXUS_DATA_DIR` to it.
- Ensure `appstate.json` and `persistent-device.json` live on this disk.

2) Single instance per account
- Run only one service instance for a given account.
- Disable autoscaling/replicas for this worker.

3) Environment hardening
- Set `NEXUS_PERSISTENT_DEVICE=true` to anchor device fingerprint.
- Set `NEXUS_DISABLE_PREFLIGHT=true` to reduce heavy checks.
- Optionally use a reputable residential/mobile proxy via `NEXUS_PROXY`.

4) Keep your appstate fresh
- Generate appstate locally on a trusted network, then deploy it.
- Avoid frequent credential logins from the server itself.

---
## 4) "You couldn't create multiple sessions" – what it means and fixes

This warning typically appears when Facebook detects concurrent or rapidly rotating logins for the same account, often from:
- Multiple bots/instances using the same account at the same time
- Different IPs or device fingerprints in quick succession
- Frequent logouts/re-logins (or unstable appstate)

How to avoid:
- Run exactly one bot instance per account.
- Reuse the same `appstate.json` and `persistent-device.json` (set `NEXUS_PERSISTENT_DEVICE=true`).
- Avoid logging in with username/password from multiple places—generate appstate once and reuse it.
- Use a stable IP. If your PaaS IPs rotate or look like a datacenter bot, use a reputable residential/mobile proxy.
- Keep preflight light on PaaS (`NEXUS_DISABLE_PREFLIGHT=true`).

Recovery steps when you see the warning:
- Stop all other running instances for the same account.
- Log in manually in a browser, pass any checkpoint, verify recent logins.
- Regenerate a fresh appstate (locally), deploy, and keep it persistent.

---
## 5) Minimal config-first example

`fca-config.json` (project root):
```json
{
  "preset": "nexflash",
  "options": { "logLevel": "warn" },
  "mqtt": { "enabled": true, "reconnectInterval": 3600 },
  "network": { "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/121.0.0.0 Safari/537.36" }
}
```

Bot code:
```js
const login = require('nexus-fca');
(async () => {
  const api = await login({ appState: require(process.env.NEXUS_APPSTATE_PATH || './appstate.json') });
  // Optional fine-tuning
  api.setOptions({
    autoReconnect: true,
    updatePresence: false,
    proxy: process.env.NEXUS_PROXY,
  });
  api.listen((err, evt) => {
    if (err) return console.error(err);
    if (evt.body) api.sendMessage('Echo: ' + evt.body, evt.threadID);
  });
})();
```

---
## 6) Troubleshooting quick tips
- Rapid cookie expiry: ensure persistence paths are on mounted disk; set `NEXUS_PERSISTENT_DEVICE=true`.
- New cookie still "cookie death" after restart: the session vault may be
  restoring an older dead copy. Check the `SESSION VAULT` log lines. Set
  `NEXUS_SESSION_VAULT_PREFER=env` to force the deployed `APPSTATE_JSON`, or
  clear the vault entry. Rejected fingerprints are remembered in
  `.nexus-vault-failure.json` and will not be replayed after a restart.
- Upload fails with `parseAndCheckLogin got status code: 400` on a media send:
  that is a media rejection, not necessarily a dead cookie. Latest lib uses the
  genuine Mercury upload shape (`farr` multipart field on
  `www.facebook.com/ajax/mercury/upload.php`). Update the library; retries now
  fail fast on 4xx instead of looping 3× every 2 s.
- Frequent reconnect warnings: let adaptive backoff work; keep `autoReconnect=true`.
- No replies sent: check proxy/network egress; use delivery metrics via `api.getHealthMetrics()`.
- Noisy logs: avoid `NEXUS_VERBOSE_MQTT` unless debugging; prefer `logLevel=warn`.

For full API details, see `DOCS.md` and other files in `docs/`.
