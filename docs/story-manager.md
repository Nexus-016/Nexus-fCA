# Story Manager — `api.storyManager`

> Manage the logged-in account's Facebook Stories: post a photo story, check the active story, or delete one.

**Added in:** Nexus-fCA 4.3.0

## Signature

```js
api.storyManager(options, callback)
```

| Parameter | Type | Required | Description |
|---|---|---|---|
| `options` | object | yes | `{ action, attachment, storyID }` |
| `options.action` | string | yes | `'add'`, `'upload'`, `'delete'` or `'check'` |
| `options.attachment` | readable stream | `add` / `upload` | Image or video stream, e.g. `fs.createReadStream('./photo.jpg')` |
| `options.storyID` | string | `delete` | Story ID to delete |
| `callback` | function | no | `(err, data)` — a Promise is returned when omitted |

## Actions

| Action | Needs | What happens |
|---|---|---|
| `add` / `upload` | `attachment` | Uploads the attachment, then creates the story (`StoriesCreateMutation`) |
| `delete` | `storyID` | Deletes the given story |
| `check` | – | Queries the current story status |

## Usage

```js
const fs = require('fs');

// Post a photo story
api.storyManager(
  { action: 'add', attachment: fs.createReadStream('./photo.jpg') },
  (err, data) => {
    if (err) return console.error('Story error:', err);
    console.log('Story created:', data.story_id);
  }
);

// Check the current story
api.storyManager({ action: 'check' }, (err, data) => {
  if (err) return console.error(err);
  console.log('Story status:', data);
});

// Delete a story
api.storyManager({ action: 'delete', storyID: '<story_id>' }, (err, data) => {
  if (err) return console.error(err);
  console.log('Story deleted');
});
```

## Response

For `add` / `upload`:

```js
{
  story_id: '<extracted story id or null>',
  logging_token: '...',
  full_response: { /* raw server response */ }
}
```

`delete` and `check` resolve with the raw Facebook response for the performed mutation/query.

## Errors

- `{ error: 'Options object is required' }` — no options passed.
- `{ error: "Action must be 'add', 'upload', 'delete', or 'check'" }`
- `{ error: 'Attachment should be a readable stream...' }` — pass `fs.createReadStream(...)`, not a Buffer/path.
- Login/permission failures surface through the standard session guard.

## Safety Notes

- Story posting is a visible, account-level action — rate-limit it in your bot logic.
- Keep `enableSafeDelays` on (default) and never loop story posts.
