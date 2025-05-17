# shareLink

Share a link to a thread (group or user).

## Usage
```js
api.shareLink('https://example.com', '1234567890', (err, res) => {
  if (err) return console.error(err);
  console.log('Link shared!', res);
});
```

## Arguments
- `url`: The URL to share (string).
- `threadID`: Target thread ID (string).
- `callback(err, res)`: Callback with error or result.
