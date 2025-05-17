# getUserInfo

Get information about one or more users.

## Usage
```js
api.getUserInfo(['10001','10002'], (err, info) => {
  if (err) return console.error(err);
  console.log('User info:', info);
});
```

## Arguments
- `userOrUsers`: User ID or array of user IDs.
- `callback(err, info)`: Callback with error or user info object.
