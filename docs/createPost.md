# createPost

Create a new Facebook post.

## Usage
```js
api.createPost('Hello, world!', (err, res) => {
  if (err) return console.error(err);
  console.log('Post created!', res);
});
```

## Arguments
- `content`: Post content (string).
- `callback(err, res)`: Callback with error or result.
