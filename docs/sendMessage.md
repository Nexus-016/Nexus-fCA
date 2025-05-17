# sendMessage

Send a message to a thread.

## Usage
```js
api.sendMessage('Hello!', '1234567890', (err, info) => {
  if (err) return console.error(err);
  console.log('Message sent!', info);
});
```

## Arguments
- `message`: Message string or message object.
- `threadID`: Thread ID (string).
- `callback(err, info)`: Callback with error or message info object.
