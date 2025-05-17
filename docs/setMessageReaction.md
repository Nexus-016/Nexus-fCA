# setMessageReaction

Set a reaction on a message.

## Usage
```js
api.setMessageReaction('👍', 'mid.$cAA...', (err) => {
  if (err) return console.error(err);
  console.log('Reaction set!');
});
```

## Arguments
- `reaction`: Emoji or reaction string.
- `messageID`: Message ID (string).
- `callback(err)`: Callback called when the operation is done (error or null).
- `forceCustomReaction`: (Optional) Force use of custom emoji (boolean).
