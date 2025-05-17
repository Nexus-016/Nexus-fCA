# markAsSeen

Mark your entire inbox as seen.

## Usage
```js
api.markAsSeen(Date.now(), (err) => {
  if (err) return console.error(err);
  console.log('Inbox marked as seen!');
});
```

## Arguments
- `seenTimestamp`: (Optional) Timestamp to mark as seen.
- `callback(err)`: Callback called when the operation is done (error or null).
