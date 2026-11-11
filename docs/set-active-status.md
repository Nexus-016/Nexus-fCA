# Set Active Status — `api.setActiveStatus`

> Turn the logged-in account's online visibility on or off (active/inactive presence).

**Added in:** Nexus-fCA 4.1.0

## Signature

```js
api.setActiveStatus(isActive, callback)
```

| Parameter | Type | Required | Description |
|---|---|---|---|
| `isActive` | boolean | yes | `true` = appear online, `false` = appear offline |
| `callback` | function | no | `(err, data)` — a Promise is returned when omitted |

## Usage

```js
// Appear offline (bot working silently)
api.setActiveStatus(false, (err, data) => {
  if (err) return console.error(err);
  console.log('Bot is now invisible');
});

// Appear online
api.setActiveStatus(true);
```

## Errors

- `{ error: 'isActive must be a boolean value' }` — pass a real boolean, not a truthy string.

## Notes

- This changes the web visibility policy (`UpdatePresenceSettingsMutation`) — it is independent of the login option `updatePresence`.
- Pair with `autoMarkRead: false` at login for a fully "stealth" bot profile.
