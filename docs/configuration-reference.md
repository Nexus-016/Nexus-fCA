# Configuration Reference (Nexus-FCA 3.0)

This document lists every supported configuration surface across the project: programmatic options, config file keys, and environment variables. Use this as a single source of truth when deploying locally or to PaaS.

---
## 1) Programmatic options (api.setOptions / login options)

These map to `globalOptions` and are available via `api.setOptions({ ... })` or by passing as the second argument to `login(credentials, options)`.

- Booleans
  - `online` (default: true) – Advertise chat availability when connected
  - `selfListen` – Receive your own sent messages
  - `listenEvents` – Emit non-message events (nicknames, pins, joins, etc.)
  - `listenTyping` – Emit typing events
  - `updatePresence` – Enable presence updates processing
  - `forceLogin` – Force legacy login behavior where applicable
  - `autoMarkDelivery` – Auto mark delivery for inbound messages
  - `autoMarkRead` – Auto mark read for inbound messages
  - `autoReconnect` (default: true) – Reconnect MQTT after disconnect
  - `emitReady` – Emit a synthetic `ready` event after connect

- Strings
  - `logLevel`: 'silent' | 'error' | 'warn' | 'info' | 'verbose'
  - `pageID`: string – Page scope for actions
  - `userAgent`: string – Overrides UA for outbound requests
  - `proxy`: string – HTTP(S) proxy URL
  - `acceptLanguage`: string – Accept-Language header for MQTT/Web requests

- Numbers
  - `logRecordSize` – npmlog ring buffer size

- Advanced (set via helper methods)
  - `api.setBackoffOptions({ base, factor, max, jitter })` – Adaptive MQTT reconnect backoff tuning
  - `api.setEditOptions({ maxPendingEdits, editTTLms, ackTimeoutMs, maxResendAttempts })` – Message edit safety controls
  - `api.enableLazyPreflight(enable=true)` – When true, preflight is lighter/skipped if recent successful connect
  - Group queue controls for large group threads:
    - `api.enableGroupQueue(enable=true)`
    - `api.setGroupQueueCapacity(n)`
    - Internals: `groupQueueIdleMs` (default 30m) – idle purge window

Notes:
- Unknown keys passed to `setOptions` are warned and ignored.
- `api.listen` is an alias of `api.listenMqtt`.

---
## 2) Config file: fca-config.json

Auto-created in project root on first run as the **full template** (every
option, with `null` meaning "inherit the preset"). One file now controls the
whole engine: presets tune the safety/speed trade-off, and any individual
knob can be overridden by hand. Restart after editing.

Presets (`"preset": "..."`):

| Preset    | Behaviour                                                        |
|-----------|------------------------------------------------------------------|
| `safety`  | Default. Conservative pacing, 1.2–2.5 s adaptive send delay, all keep-alive checks on. |
| `ultra`   | Maximum protection. 2.5–5 s delay, ultra-low-ban mode, tighter guard spacing. |
| `nexflash`| Safe keep-alive features stay on (headers, UA continuity, login validation, auto-refresh), but sends are near-instant (0–120 ms) and no extra heartbeat/breath/recycle traffic. |
| `none`    | No safety shaping at all: no delays, no safe headers, no timers, no light poke. |

Template shape (abridged; the file on disk lists everything):

```json
{
  "preset": "safety",
  "autoUpdate": false,
  "autoLogin": false,
  "credentials": { "email": "", "password": "", "twofactor": "" },
  "options": {
    "online": true, "selfListen": false, "listenEvents": false,
    "listenTyping": false, "updatePresence": false, "forceLogin": false,
    "autoMarkDelivery": true, "autoMarkRead": false, "autoReconnect": true,
    "emitReady": false, "logLevel": "info", "pauseLog": false, "logRecordSize": 100
  },
  "network": {
    "proxy": "", "userAgent": "", "acceptLanguage": "en-US,en;q=0.9",
    "randomUserAgent": false, "disablePreflight": false
  },
  "mqtt": { "enabled": true, "reconnectInterval": 3600, "lsSendTimeoutMs": 15000 },
  "safety": {
    "enabled": null,
    "sendDelay": { "min": null, "max": null },
    "riskThrottle": null, "humanDelays": null, "safeHeaders": null,
    "uaContinuity": null, "loginValidation": null, "autoRefresh": null,
    "regionBypass": null, "ultraLowBanMode": null, "heartbeat": null,
    "sessionBreath": null, "periodicRecycle": null,
    "lightPokeIntervalMs": null, "adaptivePacingMs": null, "minActionSpacingMs": null
  },
  "attachments": { "uploadField": "farr", "uploadRetries": 3, "uploadRetryDelayMs": 2000 },
  "health": { "enabled": false, "port": 3001 },
  "sessionVault": { "url": "", "token": "", "method": "", "prefer": "vault" }
}
```

Notes:
- A `null` value in `safety` inherits the selected preset. Any concrete value
  overrides just that knob (e.g. keep `ultra` but lower `sendDelay.max`).
- `safety.enabled: false` behaves like the `none` preset.
- `preset: "nexflash"` is the "safe but fast" choice: it keeps the protections
  that prevent cookie death, and drops only artificial delays and extra
  background traffic.
- Legacy minimal configs (`autoUpdate` + `mqtt` only) keep working — they get
  the `safety` preset defaults for everything else.
- `sessionVault.url/token/prefer` are bridged to the `NEXUS_SESSION_VAULT_*`
  envs, but real environment variables always win.
- For secrets and per-deploy toggles, prefer environment variables.

---
## 3) Environment variables

Environment variables are the primary way to configure behavior in production. They override defaults and complement programmatic options.

### 3.1 Storage & persistence
- `NEXUS_DATA_DIR` – Base directory for persistent files (fallback: `RENDER_DATA_DIR` or CWD)
- `NEXUS_APPSTATE_PATH` – Path to appstate.json
- `NEXUS_CREDENTIALS_PATH` – Path to credentials.json (integrated login)
- `NEXUS_BACKUP_PATH` – Directory for appstate backups
- `NEXUS_DEVICE_FILE` – Path to persistent-device.json
- `NEXUS_PERSISTENT_DEVICE` = true|false – Keep stable device fingerprint

### 3.2 Networking & headers
- `NEXUS_PROXY` – HTTP(S) proxy URL (also respects `HTTPS_PROXY` / `HTTP_PROXY`)
- `NEXUS_ACCEPT_LANGUAGE` – Example: `en-US,en;q=0.9`
- `NEXUS_UA` – Override User-Agent
- `NEXUS_REGION` – Force MQTT region (e.g., `HIL`)

### 3.3 Stability & preflight
- `NEXUS_DISABLE_PREFLIGHT` = true|false – Skip heavy preflight validation
- `NEXUS_ONLINE` = true|false – Override chat availability flag
- `NEXUS_VERBOSE_MQTT` = true|false – Extra MQTT diagnostics logging

### 3.4 Single-session guard (prevents concurrent runs)
- `NEXUS_SESSION_LOCK_PATH` – Path for session lock file (default: `<DATA_DIR>/session.lock`)
- `NEXUS_SESSION_TTL_MS` – Lock stale timeout (default: 900000 = 15m)
- `NEXUS_FORCE_LOCK` = true|false – Force takeover if lock present

### 3.5 Safety layer & allow/block lists
- `NEXUS_FCA_ULTRA_SAFE_MODE` = '1' – Maximum protection presets
- `NEXUS_FCA_SAFE_MODE` = '1' – Safe mode presets
- `NEXUS_FCA_ALLOW_LIST` – Comma-separated userIDs allowed
- `NEXUS_FCA_BLOCK_LIST` – Comma-separated userIDs blocked

### 3.6 Session vault (ephemeral PaaS cookie persistence)
- `NEXUS_SESSION_VAULT_URL` – HTTP endpoint holding the freshest session
- `NEXUS_SESSION_VAULT_TOKEN` – Bearer token / jsonbin `X-Master-Key`
- `NEXUS_SESSION_VAULT_METHOD` – `PUT` or `POST` (auto-detected by default)
- `NEXUS_SESSION_VAULT_PREFER=env` – Skip the vault restore and always use
  the `APPSTATE_JSON` / `appstate.json` bootstrap copy (escape hatch)
- Rejected sessions are remembered across restarts in
  `.nexus-vault-failure.json` (SHA-256 fingerprint only, never cookies), so a
  restart does not replay the same dead copy.

### 3.7 Example-only envs (for quick scripts)
Used in example snippets and README demos; not used by the core library itself:
- `FB_EMAIL` – Facebook username/email
- `FB_PASS` / `FB_PASSWORD` – Facebook password
- `FB_2FA_SECRET` – TOTP secret for 2FA (if used)
- `EMAIL` / `PASSWORD` – Alternative names used in example scripts
- `DEBUG` – e.g. `nexus-fca:*` to enable debug output in certain examples

---
## 4) Integrated Nexus Login System options

Used internally for credential-based login; also exported for direct use via `IntegratedNexusLoginSystem`. Options can be provided in code or via the env overrides above.

- Paths & persistence
  - `appstatePath` (env: `NEXUS_APPSTATE_PATH`)
  - `credentialsPath` (env: `NEXUS_CREDENTIALS_PATH`)
  - `backupPath` (env: `NEXUS_BACKUP_PATH`)
  - `persistentDevice` (env: `NEXUS_PERSISTENT_DEVICE`)
  - `persistentDeviceFile` (env: `NEXUS_DEVICE_FILE`)

- Behavior
  - `autoLogin` (default: true)
  - `autoSave` (default: true)
  - `safeMode` (default: true)
  - `maxRetries` (default: 3)
  - `retryDelay` (default: 5000 ms)

---
## 5) MQTT & connection behavior

Controlled via programmatic options and envs:

- `autoReconnect` (default true) – Reconnect on close/error
- Backoff: `api.setBackoffOptions({ base, factor, max, jitter })`
- Keepalives & diagnostics: `NEXUS_VERBOSE_MQTT` for extra logs
- Headers: `acceptLanguage`, `userAgent`, `proxy`
- Region override: `NEXUS_REGION`

---
## 6) Delivery & read behavior

- `autoMarkDelivery` – Calls `markAsDelivered` for inbound messages
- `autoMarkRead` – Optional follow-up read marking
- Adaptive suppression & retries are built-in; metrics accessible via `api.getHealthMetrics()`

---
## 7) Health and memory metrics

- `api.getHealthMetrics()` – ACKs, reconnect counts, delivery stats, last connect timestamps, etc.
- `api.getMemoryMetrics()` – Pending edits, outbound queue depth, group queue prunes, memory guard actions

---
## 8) Logging

- `logLevel`: 'silent' | 'error' | 'warn' | 'info' | 'verbose'
- `logRecordSize`: ring buffer size
- Temporarily increase MQTT verbosity with `NEXUS_VERBOSE_MQTT=true` when debugging

---
## 9) Quick matrix (where to set)

| Setting                        | setOptions | login options | fca-config.json | ENV |
|--------------------------------|------------|---------------|-----------------|-----|
| online                         | ✅         | ✅            |                 | ✅ (`NEXUS_ONLINE`) |
| selfListen / listenEvents      | ✅         | ✅            |                 |     |
| updatePresence                 | ✅         | ✅            |                 |     |
| autoMarkDelivery / autoMarkRead| ✅         | ✅            |                 |     |
| autoReconnect                  | ✅         | ✅            |                 |     |
| userAgent                      | ✅         | ✅            | ✅               | ✅ (`NEXUS_UA`) |
| proxy                          | ✅         | ✅            | ✅               | ✅ (`NEXUS_PROXY`/`HTTPS_PROXY`/`HTTP_PROXY`) |
| acceptLanguage                 | ✅         | ✅            |                 | ✅ (`NEXUS_ACCEPT_LANGUAGE`) |
| disablePreflight               | via `enableLazyPreflight(false)` | ✅ |       | ✅ (`NEXUS_DISABLE_PREFLIGHT`) |
| pageID                         | ✅         | ✅            |                 |     |
| backoff/edit settings          | helper fns |               |                 |     |
| data/appstate/backup/device    |            | via Integrated Login |         | ✅ (`NEXUS_*` paths) |
| session guard (lock/ttl/force) |            |               |                 | ✅ |
| safety modes / lists           |            |               |                 | ✅ |

---
## 10) Recommended PaaS baseline

Set at minimum:

```
NEXUS_DATA_DIR=/var/data/nexus-fca
NEXUS_APPSTATE_PATH=/var/data/nexus-fca/appstate.json
NEXUS_DEVICE_FILE=/var/data/nexus-fca/persistent-device.json
NEXUS_PERSISTENT_DEVICE=true
NEXUS_ACCEPT_LANGUAGE=en-US,en;q=0.9
# Optional hardening
NEXUS_DISABLE_PREFLIGHT=true
# Optional proxy/region
# NEXUS_PROXY=http://user:pass@host:port
# NEXUS_REGION=HIL
```

See also: `docs/deployment-config.md` for end-to-end deployment steps.
