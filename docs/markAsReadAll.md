# markAsReadAll

Mark all messages in your inbox as read.

## Usage
```js
api.markAsReadAll((err) => {
  if (err) return console.error(err);
  console.log('All messages marked as read!');
});
```

## Arguments
- `callback(err)`: Callback called when the operation is done (error or null).
