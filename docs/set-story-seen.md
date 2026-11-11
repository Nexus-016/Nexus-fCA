# Set Story Seen — `api.setStorySeen`

> Mark a story (or a whole story bucket) as seen from the logged-in account.

**Added in:** Nexus-fCA 4.1.0

## Signature

```js
api.setStorySeen(storyID, callback)
```

| Parameter | Type | Required | Description |
|---|---|---|---|
| `storyID` | string | yes | Story ID — accepts the raw numeric ID or a base64-encoded story key |
| `callback` | function | no | `(err, data)` — a Promise is returned when omitted |

## Story ID Formats

- Numeric bucket/story ID: used directly.
- Base64-encoded key (contains `:`): decoded automatically and the numeric bucket ID is extracted — you can pass either form.

## Usage

```js
api.setStorySeen('<story_id>', (err, data) => {
  if (err) return console.error(err);
  console.log('Story marked as seen');
});
```

## Errors

- `{ error: 'storyID is required' }` — empty/missing ID.
- Server errors return the raw error payload.

## Safety Notes

- Bulk story-seen sweeps look automated — if your bot auto-views stories, spread calls out over time.
