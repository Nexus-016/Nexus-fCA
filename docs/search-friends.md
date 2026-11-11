# Search Friends — `api.searchFriends`

> Search the logged-in account's own friend list by name.

**Added in:** Nexus-fCA 4.1.0

## Signature

```js
api.searchFriends(searchQuery, callback)
```

| Parameter | Type | Required | Description |
|---|---|---|---|
| `searchQuery` | string | yes | Non-empty search text |
| `callback` | function | no | `(err, result)` — a Promise is returned when omitted |

## Usage

```js
api.searchFriends('Rahim', (err, results) => {
  if (err) return console.error(err);
  console.log(`Found ${results.length} friends`);
  results.forEach(f => console.log(f));
});
```

## Response

Array of friend entries from the friend-list pagination query (up to 20 per call, server-side).

## Errors

- `Error('Search query cannot be empty')` — blank query.

## Notes

- Searches only **your own** friends (friend-list renderer query) — not global Facebook search.
- For user lookups by ID, use `api.getUserInfo(userID)` instead.
