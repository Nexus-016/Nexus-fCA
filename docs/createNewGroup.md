# createNewGroup

Create a new group chat.

## Usage
```js
api.createNewGroup(['10001','10002'], 'My Group', (err, threadID) => {
  if (err) return console.error(err);
  console.log('Group created! ID:', threadID);
});
```

## Arguments
- `participantIDs`: Array of user IDs.
- `groupTitle`: (Optional) Group name (string).
- `callback(err, threadID)`: Callback with error or new thread ID.
