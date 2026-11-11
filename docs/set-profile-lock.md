# Set Profile Lock — `api.setProfileLock`

> Lock or unlock the logged-in account's profile (restrict who can see the timeline/photos beyond friends).

**Added in:** Nexus-fCA 4.1.0

## Signature

```js
api.setProfileLock(enable, callback)
```

| Parameter | Type | Required | Description |
|---|---|---|---|
| `enable` | boolean | yes | `true` = lock profile, `false` = unlock |
| `callback` | function | no | `(err, data)` — a Promise is returned when omitted |

## Usage

```js
api.setProfileLock(true, (err, data) => {
  if (err) return console.error('Profile lock failed:', err);
  console.log('Profile locked');
});
```

## Errors

- `Error('enable must be a boolean value')` — pass a real boolean.
- Server-side rejections (rate limit, checkpoint) return the raw error payload.

## Notes

- Equivalent to the profile-lock toggle in Facebook settings (`WemPrivateSharingMutation`).
- Useful right after credential logins on new accounts, before the account starts messaging.
