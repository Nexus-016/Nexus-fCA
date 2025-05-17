# markAsRead

Mark all unread messages in a thread as read.

## Usage
```js
api.markAsRead('1234567890', true, (err) => {
  if (err) return console.error(err);
  console.log('Marked as read!');
});
```

## Arguments
- `threadID`: Thread ID (string).
- `read`: (Optional) Boolean to mark as read (true) or unread (false).
- `callback(err)`: Callback called when the operation is done (error or null).
