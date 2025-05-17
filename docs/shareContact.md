# shareContact

Share a contact in a thread.

## Usage
```js
api.shareContact('1000123456789', '1234567890', (err) => {
  if (err) return console.error(err);
  console.log('Contact shared!');
});
```

## Arguments
- `userID`: User ID to share (string).
- `threadID`: Thread ID (string).
- `callback(err)`: Callback called when the operation is done (error or null).
