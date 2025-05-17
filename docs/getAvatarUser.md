# getAvatarUser

Get the avatar (profile picture) of a user.

## Usage
```js
api.getAvatarUser('1000123456789', (err, url) => {
  if (err) return console.error(err);
  console.log('Avatar URL:', url);
});
```

## Arguments
- `userID`: The user ID (string).
- `callback(err, url)`: Callback with error or avatar URL.
