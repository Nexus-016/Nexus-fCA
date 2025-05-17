# changeBlockedStatus

Block or unblock a user (basic method).

## Usage
```js
api.changeBlockedStatus('1000123456789', true, (err) => {
  if (err) return console.error(err);
  console.log('User blocked!');
});
```

## Arguments
- `userID`: The user ID (string).
- `block`: Boolean to block (true) or unblock (false).
- `callback(err)`: Callback called when the operation is done (error or null).
