# getThreadHistory

Get message history for a thread.

## Usage
```js
api.getThreadHistory('1234567890', 20, undefined, (err, messages) => {
  if (err) return console.error(err);
  console.log('Messages:', messages);
});
```

## Arguments
- `threadID`: Thread ID (string).
- `amount`: Number of messages to fetch (integer).
- `timestamp`: (Optional) Fetch messages before this timestamp.
- `callback(err, messages)`: Callback with error or array of messages.
