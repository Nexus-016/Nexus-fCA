# Send Friend Request — `api.sendFriendRequest`

> Send a friend request to a user ID from the logged-in account.

**Added in:** Nexus-fCA 4.1.0

## Signature

```js
api.sendFriendRequest(userID, callback)
```

| Parameter | Type | Required | Description |
|---|---|---|---|
| `userID` | string | yes | Target Facebook user ID |
| `callback` | function | no | `(err, data)` — a Promise is returned when omitted |

## Usage

```js
api.sendFriendRequest('100012345678901', (err, data) => {
  if (err) return console.error('Friend request failed:', err);
  console.log('Friend request sent');
});
```

## Errors

- `{ error: 'User ID is required' }` — empty/missing ID.
- Already-friends / blocked / rate-limited cases return the server's error payload.

## Safety Notes

- Mass friend requests are a classic bot signal — keep this behind an explicit user command and rate-limit it.
- Respect Facebook platform terms and local laws; do not use for spam.
