# Send Buttons — `api.sendButtons`

> Send a CTA (call-to-action) button message over MQTT using a rearranged CTA identifier.

**Added in:** Nexus-fCA 4.1.0

## Signature

```js
api.sendButtons(rearrangedCtaId, text, threadID, [replyToMessageID], callback)
```

| Parameter | Type | Required | Description |
|---|---|---|---|
| `rearrangedCtaId` | string | yes | CTA identifier in rearranged (shuffled) form — the API reverses the shuffle internally before sending |
| `text` | string | yes | Message body shown above the buttons |
| `threadID` | string | yes | Target thread |
| `replyToMessageID` | string | no | Message ID to reply to |
| `callback` | function | no | `(err, data)` — a Promise is returned when omitted |

## How the CTA ID Works

Button identifiers in captured payloads arrive in a rearranged form (deterministic shuffle). This API:

1. Reverses the shuffle pattern internally (`unrearrange`).
2. Sends the decoded CTA task over MQTT (label 46).

You feed it exactly what you captured — no manual decoding needed.

## Usage

```js
api.sendButtons(ctaId, 'Choose an option', threadID, (err, data) => {
  if (err) return console.error('sendButtons failed:', err);
  console.log('Button message sent');
});

// As a reply to a specific message
api.sendButtons(ctaId, 'Choose an option', threadID, replyToMessageID);
```

## Errors

- Invalid/undecodable CTA ID: logged and the send is aborted.
- MQTT not connected: falls through the standard delivery error path (use the multi-path fallback chain).

## Notes

- Requires an active MQTT connection (same as all label-46 tasks).
- Button rendering depends on the receiving client's support — Messenger apps render CTA buttons; some surfaces may not.
