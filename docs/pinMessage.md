# pinMessage

Pin or unpin a message in a thread.

## Usage
```js
api.pinMessage(true, 'mid.$cAA...', '1234567890', (err) => {
  if (err) return console.error(err);
  console.log('Message pinned!');
});
```

## Arguments
- `pinMode`: Boolean to pin (true) or unpin (false).
- `messageID`: Message ID (string).
- `threadID`: Thread ID (string).
- `callback(err)`: Callback called when the operation is done (error or null).
