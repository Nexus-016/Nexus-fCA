# getThreadInfo

Get info about a thread (group or user chat).

## Usage
```js
api.getThreadInfo('1234567890', (err, info) => {
  if (err) return console.error(err);
  console.log('Thread info:', info);
});
```

## Arguments
- `threadID`: Thread ID (string).
- `callback(err, info)`: Callback with error or thread info object.
