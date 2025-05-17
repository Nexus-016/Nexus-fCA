# changeArchivedStatus

Archive or unarchive one or more threads.

## Usage
```js
api.changeArchivedStatus(threadOrThreads, archive, (err) => {
  if (err) return console.error(err);
  console.log('Archive status changed!');
});
```

## Arguments
- `threadOrThreads`: Thread ID or array of thread IDs.
- `archive`: Boolean (`true` to archive, `false` to unarchive).
- `callback(err)`: Callback called when the operation is done (error or null).

## Notes
- Accepts a single thread ID or an array.
