# Nexus-FCA — Documentation Overview

A hardened, high-performance Facebook Messenger client library for Node.js: native LightSpeed task operations over MQTT v5, transparent web fallbacks, local-first session management and full GoatBot V2 compatibility.

Quick links: [Complete API Reference](./COMPLETE-API-DOCS.md) · [API Methods Reference](./API-METHODS-REFERENCE.md) · [Usage Guide](./USAGE-GUIDE.md) · [Configuration Reference](./docs/configuration-reference.md) · [Deployment Guide](./docs/deployment-config.md) · [Changelog](./CHANGELOG.md)

---

## Quick Start

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

With credentials (optional TOTP 2FA):

```js
const api = await login({
  email: 'user@mail.com',
  password: 'pass',
  twofactor: 'TOTPSECRET' // optional
});
```

---

## Login Methods

| Entry point | Description |
|-------------|-------------|
| `login({ appState }, callback)` | Cookie/appstate login — the most stable path; callback or Promise |
| `login({ email, password, twofactor })` | Credential login; generates an appstate |
| `nexusLogin({ ... })` | Integrated login system (username/password/2FA or appstate); returns `{ success, api }` |
| `login.utils.checkLiveCookie(input)` | Sessionless cookie liveness probe — local, evidence-based |

---

## Session & Device Management

| Feature | Description | Control |
|---------|-------------|---------|
| Persistent Device | Reuses one stable device profile (model, deviceId, UA) to reduce checkpoint triggers | `persistentDevice: true` (default) |
| UA Fingerprint Lock | One stable Chrome identity shared by login, HTTP, MQTT and cookie checks | `fingerprintLock: true` (default) |
| Preflight Validation | Multi-endpoint session test with typed classification | Disable: `{ disablePreflight: true }` |
| Anti-Lock Guard | Dead-cookie detection at login; patient retry bands (15 → 30 → 60 min) re-reading the cookie file | Automatic |
| Session Vault | Refreshed cookie states mirrored to `NEXUS_SESSION_VAULT_URL`; freshest copy restored at boot | Environment-driven |
| Redirect Detection | Classifies `login_redirect`, `html_login_page`, `checkpoint` | Automatic |
| 5xx Retry | Bounded randomized delays on transient server errors | Built-in |

---

## LightSpeed Operations

Operations supported over the native `/ls_req` task channel (automatic silent web fallback on publish failure, task rejection or missing ack):

Message send (text/sticker/reply/mentions/locations/attachments) · edit · unsend · delete-for-self · reactions · nickname · thread emoji · thread color · group image · poll creation · poll voting · participants add/remove · admin status · mute/unmute (timed and unmute) · group rename · group creation · message-request acceptance · read watermarks.

Delivery discipline: every migrated operation is idempotent on re-application; group creation is non-idempotent and therefore reports an explicit unknown-outcome error on ack timeout instead of retrying.

---

## API Quick Reference

### Listening

```js
api.listen((err, event) => { /* message / event objects */ });
```

### Sending

```js
api.sendMessage('Hi', threadID);
api.sendMessage({ body: 'Text', attachment: fs.createReadStream('./file.pdf') }, threadID);
```

### Speed Control

```js
api.setFastSend(true);          // bypass queue for instant replies
api.setParallelSend(5);         // 5 concurrent (max)
api.setParallelSend(3);         // 3 concurrent (default)
api.enableGroupQueue(false);    // disable per-thread queueing
api.setGroupQueueCapacity(200); // adjust queue size
```

### Reactions / Typing

```js
api.setMessageReaction('❤', messageID, threadID, () => {});
api.sendTypingIndicator(threadID, true);
```

### Runtime Utilities

```js
api.getHealthMetrics();   // uptime, reconnects, ack latency, delivery stats
api.getMemoryMetrics();   // queue depths, guard counters
api.getAppState();        // current deduped cookie state
api.getOptions();         // live option set
```

Exported via `require('nexus-fca').utils`: session validation, formatting helpers, attachment normalization, safety utilities.

---

## Structured Error Types

| Type | Meaning |
|------|---------|
| `login_redirect` | Server redirected to login/checkpoint |
| `html_login_page` | HTML login or checkpoint page received |
| `not_logged_in` | Verified invalid session after retry |
| `checkpoint` | Account-level enforcement (complete the checkpoint in a browser) |

```js
api.listen((err) => {
  if (err && err.type === 'not_logged_in') {
    // Refresh appstate or alert
  }
});
```

---

## Troubleshooting

| Issue | Recommendation |
|-------|----------------|
| False logout logs | Rely on the built-in validation; do not disable cookies |
| Checkpoint after password login | Keep the persistent device fingerprint; reuse appstate; avoid frequent password relogins |
| Repeated 5xx retries | Inspect network/proxy; apply the built-in backoff |
| No messages received | Verify MQTT connectivity; ensure `listen` was not replaced by older wrappers |
| Timed mute does not stick | See the LightSpeed notes in `CHANGELOG.md` (mute value-semantics experiment switch) |

---

## Disclaimer

This project is not affiliated with, endorsed by, or connected to Meta Platforms, Inc. in any way. Use responsibly, in accordance with platform terms and applicable local laws.

## Support & Contributing

Issues and pull requests are welcome on the GitHub repository, with focus on stability, safety heuristics, protocol coverage, documentation and TypeScript types.
