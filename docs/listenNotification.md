# listenNotification

Listen for Facebook notifications (advanced, experimental).

## Usage
```js
api.listenNotification((err, notification) => {
  if (err) return console.error(err);
  console.log('Notification:', notification);
});
```

## Arguments
- `callback(err, notification)`: Callback with error or notification object.
