# changeAdminStatus

Set or remove admin status for users in a group chat.

## Usage
```js
api.changeAdminStatus(threadID, adminIDs, adminStatus, (err) => {
  if (err) return console.error(err);
  console.log('Admin status changed!');
});
```

## Arguments
- `threadID`: Group chat ID (string).
- `adminIDs`: User ID or array of user IDs to promote/demote.
- `adminStatus`: Boolean (`true` to promote, `false` to demote).
- `callback(err)`: Callback called when the operation is done (error or null).

## Notes
- Throws if arguments are not the correct type.
- `adminIDs` can be a string or array.
