# changeCover

Change your Facebook cover photo.

## Usage
```js
api.changeCover('./cover.jpg', (err, res) => {
  if (err) return console.error(err);
  console.log('Cover photo changed!', res);
});
```

## Arguments
- `imagePath`: Path to the image file (string).
- `callback(err, res)`: Callback with error or result.
