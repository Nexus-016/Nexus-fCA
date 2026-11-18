# sendMessage

Send a message to a thread.

## Usage
```js
api.sendMessage('Hello!', '1234567890', (err, info) => {
  if (err) return console.error(err);
  console.log('Message sent!', info);
});
```

## Message object
```js
api.sendMessage({
  body: 'Big news!',
  effect: 'celebration' // experimental — see Effects below
}, '1234567890');
```

| Field | Type | Notes |
|---|---|---|
| `body` | string | Message text. |
| `sticker` | string \| number | Sticker ID — owns the send type. |
| `attachment` | stream \| stream[] | Readable streams; uploaded then attached as fbids. |
| `url` | string | Share-card flow (legacy web path). |
| `emoji` | string | Emoji send. |
| `emojiSize` | `"small"` \| `"medium"` \| `"large"` | Emoji bubble size. |
| `mentions` | `{tag, id, fromIndex}[]` | Mentions pointing into `body`. |
| `location` | `{latitude, longitude, current?}` | Location share. |
| `effect` | string | (EXPERIMENTAL) Messenger effect name — see below. |
| `attachmentFbid` | string \| string[] | (EXPERIMENTAL) Raw numeric attachment fbid re-share — see below. |

Plain strings are shorthand for `{ body: "..." }`. A callback is
optional — without one, `sendMessage` returns a promise.

## Effects (EXPERIMENTAL)

`effect` wraps a plain text or emoji message in a Messenger message
effect, sent through the LightSpeed send task's `power_up_style` field
(the same `/ls_req` channel the Messenger app uses).

```js
api.sendMessage({ body: 'Big news!', effect: 'celebration' }, threadID);
api.sendMessage({ body: '🔥🔥', effect: 'fire' }, threadID);
api.sendMessage({ body: 'I miss you', effect: 'avatar_cry' }, threadID);
```

Accepted names (case-insensitive): `love`, `gift_wrap`, `celebration`,
`fire`, `avatar_love`, `avatar_anger`, `avatar_laugh`, `avatar_cry`.

**This is an explicitly experimental, best-effort feature.** The numeric
mapping is community-captured and appears in no genuine protocol
reference (the messagix and mautrix-meta SendMessageTask structs carry
no such field). The library degrades gracefully in every direction:

- The server is expected to ignore unknown payload fields, so an
  unverified mapping simply sends the message normally — without the
  visible effect.
- A send that must take the legacy web path (MQTT down or unsupported
  shape) logs a warning: the legacy endpoint has no such field.
- Sticker, attachment and location sends drop the effect with a
  warning — effects only ride text/emoji sends.
- Unknown effect names send normally with a warning instead of failing.

**Live verification (2026-11):** `love`, `gift_wrap`, `celebration` and
`fire` render their Messenger effects — the mapping is genuine for
these four values. The `avatar_*` effects did **not** render yet: either
their 1000-1003 values are wrong, or avatar effects additionally need
the sender's Meta avatar configured (the test account had none).

## attachmentFbid (EXPERIMENTAL — numeric fbids only)

An experimental field for re-sharing an already-uploaded attachment by
raw numeric fbid. **Final verdict (2026-11, confirmed against
mautrix/meta):** the genuine `SendMessageTask` types `attachment_fbids`
as `[]int64` — numeric fbids only — and the only genuine consumer use
pairs `send_type` 3 (MEDIA) with the fbid of media the sender uploaded
itself (`ReuploadFileToMeta` → `SendType MEDIA` →
`[]int64{attachmentID}`).

**Music/XMA re-share is a dead end:** the community-captured music id
(`ee.mid.$...`) is an XMA cross-reference string, not a fbid at all —
both live pairings (TEXT, then MEDIA) failed with the same empty-table
ack `{"name":null,"step":[1]}` because the server's table decode cannot
read a non-numeric row. The music bubble's own numeric fbid never
appears in thread history (only the XMA `legacy_attachment_id` string),
so the app's own registration flow stays out of reach without a real
capture of that flow. Sending real audio instead — upload the file and
let Messenger render it as a playable audio attachment — is the genuine
path that works today.

```js
// numeric fbid only — e.g. a MessageFile's message_file_fbid captured
// from getThreadHistory attachments (ID field)
api.sendMessage({ attachmentFbid: "123456789" }, threadID);
```

LightSpeed-only by design: the legacy web form cannot reference a
foreign fbid, so if MQTT is down the call errors instead of silently
degrading, and on task rejection or ack timeout the error is surfaced
directly (no web fallback, no duplicate plain-text send).

## Arguments
- `message`: Message string or message object.
- `threadID`: Thread ID (string).
- `callback(err, info)`: Callback with error or message info object.
- `replyMessageID`: Message ID to reply to (optional third argument).
