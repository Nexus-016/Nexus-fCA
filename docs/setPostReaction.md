# setPostReaction

React to a Facebook post.

## Usage
```js
api.setPostReaction('1234567890', 'LIKE', (err) => {
  if (err) return console.error(err);
  console.log('Post reaction set!');
});
```

## Arguments
- `postID`: Post ID (string).
- `reaction`: Reaction type (e.g. 'LIKE', 'LOVE', 'HAHA', etc.).
- `callback(err)`: Callback called when the operation is done (error or null).
