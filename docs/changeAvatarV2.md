# changeAvatarV2

Change your Facebook profile avatar using a local image file.

## Usage
```js
api.changeAvatarV2('./avatar.jpg', (err, res) => {
  if (err) return console.error(err);
  console.log('Avatar changed!', res);
});
```

## Arguments
- `imagePath`: Path to the image file (string).
- `callback(err, res)`: Callback with error or result.

## Safety Note
Use images that comply with Facebook's community standards.
