# Messenger Notes — `api.note`

> Read, create, update and delete the account's Messenger Note (the short status text shown in the Messenger tray).

**Added in:** Nexus-fCA 4.1.0

## Sub-Methods

| Method | Signature | Description |
|---|---|---|
| `api.note.check(callback)` | `check(cb)` | Read the current note + metadata |
| `api.note.create(text, options, callback)` | `create(text, opts, cb)` | Create a new note |
| `api.note.delete(noteID, callback)` | `delete(noteID, cb)` | Delete a note |
| `api.note.update(oldNoteID, text, options, callback)` | `update(oldID, text, opts, cb)` | Replace a note (delete + recreate) |

Aliases: `checkAdvanced`, `createAdvanced`, `deleteAdvanced`, `recreate`.

All methods return a Promise when no callback is passed.

## check

```js
api.note.check((err, data) => {
  if (err) return console.error(err);
  console.log(data);
  // {
  //   note: {...} | null,       // current note or null
  //   hasActiveNote: boolean,
  //   userId: '...',
  //   timestamp: 1730000000000,
  //   expiresAt: 1730000000000  // created_time + 24h, or null
  // }
});
```

## create

```js
api.note.create('hello', { privacy: 'FRIENDS' }, (err, data) => {
  if (err) return console.error(err);
  console.log('Note created, expires at', new Date(data.expiresAt));
});
```

| Option | Default | Description |
|---|---|---|
| `privacy` | `'FRIENDS'` | Audience scope for the note |
| `duration` | `86400` | Lifetime in seconds (24h default) |
| `noteType` | `'TEXT_NOTE'` | Note type |

Validation: text must be non-empty and **max 280 characters**.

Response includes the server status plus `{ createdAt, expiresAt, characterCount, privacy }`.

## delete

```js
api.note.delete('<note_id>', (err, data) => {
  if (err) return console.error(err);
  // data = { ...deletedStatus, deletedAt, noteId }
});
```

## update

```js
api.note.update('<old_note_id>', 'new text', { privacy: 'FRIENDS' }, (err, data) => {
  if (err) return console.error(err);
  // data = { deleted, created, updatedAt }
});
```

`update` deletes the old note, waits ~1s, then creates the new one — both server mutations are included in the response.

## Errors

- `Error('Note text cannot be empty')` / `Error('Note text cannot exceed 280 characters')`
- `Error('Note ID is required')`
- Server errors surface as the first `resData.errors` entry.

## Safety Notes

- Notes are publicly visible to the chosen audience — do not put session/host info in them.
- Rapid create/delete cycling is noisy; update at most once per few minutes in bot logic.
