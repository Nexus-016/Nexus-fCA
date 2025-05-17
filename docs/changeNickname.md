# changeNickname

Change a user's nickname in a thread.

## Usage
```js
api.changeNickname('Cool Guy', '1234567890', '1000123456789', (err) => {
  if (err) return console.error(err);
  console.log('Nickname changed!');
});
```

## Arguments
- `nickname`: New nickname (string).
- `threadID`: Thread ID (string).
- `participantID`: User ID (string).
- `callback(err)`: Callback called when the operation is done (error or null).
