# changeBlockedStatusMqtt

Block or unblock a user using the MQTT protocol.

## Usage
```js
api.changeBlockedStatusMqtt('1000123456789', true, (err, res) => {
  if (err) return console.error(err);
  console.log('User blocked!', res);
});
```

## Arguments
- `userID`: The user ID (string).
- `block`: Boolean to block (true) or unblock (false).
- `callback(err, res)`: Callback with error or result.
