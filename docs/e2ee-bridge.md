# E2EE Bridge — `api.connectE2EE`

> Optional end-to-end-encryption bridge for secret conversations. **Opt-in, BETA, off by default** — the bot runs exactly as before when disabled (zero risk when off).

**Added in:** Nexus-fCA 4.3.0

## Requirements

1. Login option: `{ enableE2EE: true }`
2. Native deps: `npm i koffi yumi-json-bigint`
3. The Labyrinth native binary (see the `e2ee.js` header for setup)

## API Surface

| Method | Signature | Description |
|---|---|---|
| `api.connectE2EE(cb)` | `connectE2EE(callback)` | Starts the bridge; encrypted events arrive via the callback |
| `api.getE2EEBridge()` | `getE2EEBridge()` | Returns the active bridge handle or `null` |
| `api.getE2EEDeviceData(cb)` | `getE2EEDeviceData(callback)` | Device keys/data (cached after first call) |

When enabled at login, send/reaction/typing/media helpers are patched automatically (`patchApiForE2EE`) — reactions and typing indicators route through E2EE for confirmed E2EE threads, and fall through to normal routes otherwise.

## Usage

```js
const api = await login({ appState }, { enableE2EE: true });

api.connectE2EE((err, evt) => {
  if (err) return console.error('E2EE error:', err);
  // encrypted events: e2eeMessage, e2eeMessageEdit, e2eeReaction, e2eeReceipt ...
  console.log('E2EE event:', evt.type);
});

const deviceData = await api.getE2EEDeviceData();
```

## When Disabled

- `api.connectE2EE(cb)` rejects with: `E2EE is not enabled. Login with { enableE2EE: true } and install native deps: npm i koffi yumi-json-bigint`
- No other API behavior changes — all normal routes stay active.

## Status

**BETA** — requires validation against live secret conversations before production reliance. Keep it off unless you specifically need encrypted routes.
