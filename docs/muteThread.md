# muteThread

Mute or unmute a thread for a period of time.

## Usage
```js
api.muteThread('1234567890', 60, (err) => {
  if (err) return console.error(err);
  console.log('Thread muted!');
});
```

## Arguments
- `threadID`: Thread ID (string).
- `muteSeconds`: Number of seconds to mute (0 to unmute, -1 for indefinite).
- `callback(err)`: Callback called when the operation is done (error or null).
