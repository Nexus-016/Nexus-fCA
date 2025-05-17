# sendComment

Send a comment to a Facebook post.

## Usage
```js
api.sendComment('1234567890', 'Great post!', (err, res) => {
  if (err) return console.error(err);
  console.log('Comment sent!', res);
});
```

## Arguments
- `postID`: The post ID (string).
- `comment`: Comment text (string).
- `callback(err, res)`: Callback with error or result.
