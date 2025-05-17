# changeBio

Change your Facebook profile bio.

## Usage
```js
api.changeBio('This is my new bio!', (err, res) => {
  if (err) return console.error(err);
  console.log('Bio changed!', res);
});
```

## Arguments
- `bio`: New bio text (string).
- `callback(err, res)`: Callback with error or result.
