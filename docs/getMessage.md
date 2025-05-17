# getMessage

Get a message by ID (advanced/utility).

## Usage
```js
api.getMessage('mid.$cAA...', (err, message) => {
  if (err) return console.error(err);
  console.log('Message:', message);
});
```

## Arguments
- `messageID`: The message ID (string).
- `callback(err, message)`: Callback with error or message object.
