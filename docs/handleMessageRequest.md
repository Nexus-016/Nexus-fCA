# handleMessageRequest

Accept or ignore message requests for one or more threads.

## Usage
```js
api.handleMessageRequest('1234567890', true, (err) => {
  if (err) return console.error(err);
  console.log('Message request handled!');
});
```

## Arguments
- `threadID`: Thread ID or array of thread IDs.
- `accept`: Boolean to accept (true) or ignore (false).
- `callback(err)`: Callback called when the operation is done (error or null).
