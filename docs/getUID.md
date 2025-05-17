# getUID

Get the Facebook user ID from a username.

## Usage
```js
api.getUID('zuck', (err, userID) => {
  if (err) return console.error(err);
  console.log('User ID:', userID);
});
```

## Arguments
- `username`: The Facebook username (string).
- `callback(err, userID)`: Callback with error or user ID.
