# removeUserFromGroup

Remove a user from a group chat.

## Usage
```js
api.removeUserFromGroup('1000123456789', '1234567890', (err) => {
  if (err) return console.error(err);
  console.log('User removed from group!');
});
```

## Arguments
- `userID`: User ID (string).
- `threadID`: Group chat ID (string).
- `callback(err)`: Callback called when the operation is done (error or null).
