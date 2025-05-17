# addUserToGroup

Add a user or users to a group chat.

## Usage
```js
api.addUserToGroup(userID, threadID, (err) => {
  if (err) return console.error(err);
  console.log('User(s) added to group!');
});
```

## Arguments
- `userID`: User ID or array of user IDs.
- `threadID`: Group chat ID (string or number).
- `callback(err)`: Callback called when the operation is done (error or null).

## Notes
- `userID` can be a single ID or an array of IDs.
- Throws an error if `threadID` is not a string or number.
