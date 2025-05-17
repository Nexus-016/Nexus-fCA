# markAsDelivered

Mark a message as delivered in a thread.

## Usage
```js
api.markAsDelivered('1234567890', 'mid.$cAA...', (err) => {
  if (err) return console.error(err);
  console.log('Marked as delivered!');
});
```

## Arguments
- `threadID`: Thread ID (string).
- `messageID`: Message ID (string).
- `callback(err)`: Callback called when the operation is done (error or null).
