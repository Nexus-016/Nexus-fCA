# createCommentPost

Comment on a Facebook post.

## Usage
```js
api.createCommentPost('1234567890', 'Nice post!', (err, res) => {
  if (err) return console.error(err);
  console.log('Comment posted!', res);
});
```

## Arguments
- `postID`: The post ID (string).
- `comment`: Comment text (string).
- `callback(err, res)`: Callback with error or result.
