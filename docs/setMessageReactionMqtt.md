# setMessageReactionMqtt

Set a message reaction using the MQTT protocol (advanced, faster, more reliable for some accounts).

## Usage
```js
api.setMessageReactionMqtt('mid.$cAA...', '👍', (err, res) => {
  if (err) return console.error(err);
  console.log('Reaction sent!', res);
});
```

## Arguments
- `messageID`: The message ID (string).
- `reaction`: Emoji or reaction string.
- `callback(err, res)`: Callback with error or result.
