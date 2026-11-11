# Set Thread Theme — `api.setThreadTheme`

> Apply a theme (including AI-generated ones) to a thread over MQTT.

**Added in:** Nexus-fCA 4.1.0

## Signature

```js
api.setThreadTheme(threadID, themeFBID, callback)
```

| Parameter | Type | Required | Description |
|---|---|---|---|
| `threadID` | string | yes | Target thread |
| `themeFBID` | string | yes | Theme FBID to apply |
| `callback` | function | no | `(err, data)` — a Promise is returned when omitted |

## Usage

```js
// Generate an AI theme and apply it
api.createThemeAI('sunset vibes', (err, theme) => {
  if (err) return console.error(err);
  api.setThreadTheme(threadID, theme.id, (err2, data) => {
    if (err2) return console.error(err2);
    console.log('Theme applied');
  });
});
```

## Errors

- `Error('Not connected to MQTT')` — no active MQTT connection (this API sends an MQTT task, not HTTP).

## Notes

- Theme changes are visible to all thread members.
- For a plain color change without a full theme, use `api.changeThreadColor(colorHex, threadID)`.
