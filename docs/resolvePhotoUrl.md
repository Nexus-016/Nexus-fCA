# resolvePhotoUrl

Get the full-size URL of a photo by its ID.

## Usage
```js
api.resolvePhotoUrl('1234567890', (err, url) => {
  if (err) return console.error(err);
  console.log('Photo URL:', url);
});
```

## Arguments
- `photoID`: Photo ID (string).
- `callback(err, url)`: Callback with error or photo URL string.
