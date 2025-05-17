# deleteThread

Delete one or more threads by ID.

## Usage
```js
api.deleteThread('1234567890', (err) => {
  if (err) return console.error(err);
  console.log('Thread deleted!');
});
```

## Arguments
- `threadOrThreads`: Thread ID or array of thread IDs.
- `callback(err)`: Callback called when the operation is done (error or null).
