# changeAvatar

Change your Facebook profile avatar (profile picture).

## Usage
```js
api.changeAvatar(fs.createReadStream('./avatar.jpg'), 'My new avatar!', null, (err, res) => {
  if (err) return console.error(err);
  console.log('Avatar changed!', res);
});
```

## Arguments
- `image`: File stream of the image.
- `caption`: (Optional) Caption for the image (string).
- `timestamp`: (Optional) Timestamp for the change (null for now).
- `callback(err, res)`: Callback with error or result.

## Notes
- Use a readable stream for the image file.
- You can add a caption or leave it blank.
