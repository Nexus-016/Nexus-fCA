# getFriendsList

Get a list of your Facebook friends.

## Usage
```js
api.getFriendsList((err, friends) => {
  if (err) return console.error(err);
  console.log('Friends:', friends);
});
```

## Arguments
- `callback(err, friends)`: Callback with error or array of friend objects.
