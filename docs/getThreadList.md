# getThreadList

Get a list of threads (conversations).

## Usage
```js
api.getThreadList(10, null, ['INBOX'], (err, threads) => {
  if (err) return console.error(err);
  console.log('Threads:', threads);
});
```

## Arguments
- `limit`: Number of threads to fetch (integer).
- `timestamp`: (Optional) Fetch threads before this timestamp (null for now).
- `tags`: Array of tags (e.g. ['INBOX']).
- `callback(err, threads)`: Callback with error or array of thread objects.
