# sendTypingIndicator

Send a typing indicator to a thread.

## Usage
```js
api.sendTypingIndicator('1234567890', (err) => {
  if (err) return console.error(err);
  console.log('Typing indicator sent!');
});
```

## Arguments
- `threadID`: Thread ID (string).
- `callback(err)`: Callback called when the operation is done (error or null).
