# setProfileGuard

Enable or disable Facebook profile picture guard.

## Usage
```js
api.setProfileGuard(true, (err, res) => {
  if (err) return console.error(err);
  console.log('Profile guard enabled!', res);
});
```

## Arguments
- `enable`: Boolean to enable (true) or disable (false) guard.
- `callback(err, res)`: Callback with error or result.
