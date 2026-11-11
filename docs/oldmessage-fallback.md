# OldMessage Fallback — `api.OldMessage`

> Legacy HTTP send path (`messaging/send/`) for when the MQTT send path fails. The last link in the delivery fallback chain: MQTT publish → HTTP send → direct → **OldMessage**.

**Added in:** Nexus-fCA 4.3.0

## Signature

```js
api.OldMessage(message, threadID, [callback])
```

| Parameter | Type | Description |
|---|---|---|
| `message` | string \| object | Message body or full message object |
| `threadID` | string | Target thread |
| `callback` | function | `(err, messageInfo)` — a Promise is returned when omitted |

## Message Object Properties

| Property | Type | Description |
|---|---|---|
| `body` | string | Message text |
| `attachment` | readable stream \| array | `fs.createReadStream(...)` — uploaded via `ajax/mercury/upload.php` |
| `sticker` | string | Sticker ID |
| `emoji` | string | Emoji character |
| `emojiSize` | string | Emoji size |
| `url` | string | Link preview URL |
| `mentions` | array | Mentions |
| `location` | object | Location attachment |

## Usage

```js
// Simple text fallback
api.OldMessage('hello', threadID, (err, info) => {
  if (err) return console.error('OldMessage failed:', err);
  console.log('Sent via legacy path:', info.messageID);
});

// With attachment
api.OldMessage(
  { body: 'Backup send', attachment: require('fs').createReadStream('./img.png') },
  threadID
);
```

## When To Use

- Automatically useful when `api.sendMessage` reports repeated MQTT-side failures.
- As a manual escape hatch in custom send pipelines:

```js
async function sendWithFallback(msg, threadID) {
  try {
    return await api.sendMessage(msg, threadID);
  } catch (e) {
    console.warn('MQTT send failed, falling back:', e.error || e.message);
    return api.OldMessage(msg, threadID);
  }
}
```

## Notes

- This path is intentionally kept as a classic HTTP sender — it bypasses MQTT entirely.
- Attachments must be readable streams (same rule as `sendMessage`).
- Delivery latency is typically higher than the MQTT path; use it as a fallback, not the default.
