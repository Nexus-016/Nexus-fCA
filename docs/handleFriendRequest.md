# handleFriendRequest

Accept or reject a friend request.

## Usage
```js
api.handleFriendRequest('1000123456789', true, (err) => {
  if (err) return console.error(err);
  console.log('Friend request handled!');
});
```

## Arguments
- `userID`: User ID (string).
- `accept`: Boolean to accept (true) or reject (false).
- `callback(err)`: Callback called when the operation is done (error or null).
