# uploadAttachment

Upload an attachment to Facebook (utility/advanced).

## Usage
```js
api.uploadAttachment(fs.createReadStream('./file.jpg'), (err, res) => {
  if (err) return console.error(err);
  console.log('Attachment uploaded!', res);
});
```

## Arguments
- `fileStream`: Readable stream of the file.
- `callback(err, res)`: Callback with error or result object.
