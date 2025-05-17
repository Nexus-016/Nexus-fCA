# getThreadPictures

Get pictures sent in a thread.

## Usage
```js
api.getThreadPictures('1234567890', 0, 10, (err, pictures) => {
  if (err) return console.error(err);
  console.log('Pictures:', pictures);
});
```

## Arguments
- `threadID`: Thread ID (string).
- `offset`: Start index (integer).
- `limit`: Number of pictures to fetch (integer).
- `callback(err, pictures)`: Callback with error or array of picture objects.
