# changeName

Change your Facebook profile name.

## Usage
```js
api.changeName('New Name', (err, res) => {
  if (err) return console.error(err);
  console.log('Name changed!', res);
});
```

## Arguments
- `newName`: New name (string).
- `callback(err, res)`: Callback with error or result.

## Safety Note
Changing your name too frequently may result in Facebook restrictions.
