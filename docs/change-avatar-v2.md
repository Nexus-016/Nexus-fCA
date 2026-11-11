# Change Avatar V2 — `api.changeAvatarV2`

> Update the logged-in account's profile picture from an image URL using the current (V2) upload flow.

**Added in:** Nexus-fCA 4.1.0 — the older `api.changeAvatar` remains available and untouched.

## Signature

```js
api.changeAvatarV2(imageURL, caption, callback)
```

| Parameter | Type | Required | Description |
|---|---|---|---|
| `imageURL` | string | yes | Direct image URL (fetched as a stream internally via axios) |
| `caption` | string | no | Caption for the profile picture update |
| `callback` | function | no | `(err, data)` — a Promise is returned when omitted |

## Flow

1. Fetches the image from `imageURL` (axios stream).
2. Uploads it via `profile/picture/upload/`.
3. Sets it as the profile picture via `ProfileCometProfilePictureSetMutation` (with your caption).

## Usage

```js
api.changeAvatarV2('https://example.com/avatar.jpg', 'New profile pic', (err, data) => {
  if (err) return console.error('Avatar update failed:', err);
  console.log('Profile picture updated');
});
```

## Errors

- Unreachable image URL → axios fetch error surfaces directly.
- Upload/set rejection → raw server error payload.

## Notes

- The image must be publicly downloadable from the given URL (no auth-protected URLs).
- Frequent avatar changes are an account-quality signal — keep it rare in automation.
