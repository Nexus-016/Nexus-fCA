# changeGroupImage

Change the group chat's image.

## Usage
```js
api.changeGroupImage(fs.createReadStream('./group.jpg'), '1234567890', (err) => {
  if (err) return console.error(err);
  console.log('Group image changed!');
});
```

## Arguments
- `image`: File stream of the image.
- `threadID`: Group chat ID (string).
- `callback(err)`: Callback called when the operation is done (error or null).
