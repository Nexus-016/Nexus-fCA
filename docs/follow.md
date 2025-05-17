# follow

Follow a Facebook user.

## Usage
```js
api.follow('1000123456789', (err, res) => {
  if (err) return console.error(err);
  console.log('Now following user!', res);
});
```

## Arguments
- `userID`: The user ID to follow (string).
- `callback(err, res)`: Callback with error or result.
