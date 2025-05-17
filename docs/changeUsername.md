# changeUsername

Change your Facebook username.

## Usage
```js
api.changeUsername('newusername', (err, res) => {
  if (err) return console.error(err);
  console.log('Username changed!', res);
});
```

## Arguments
- `username`: New username (string).
- `callback(err, res)`: Callback with error or result.
