# unsendMessage

Unsend (revoke) a message you sent.

## Usage
```js
api.unsendMessage('mid.$cAA...', (err) => {
  if (err) return console.error(err);
  console.log('Message unsent!');
});
```

## Arguments
- `messageID`: Message ID (string).
- `callback(err)`: Callback called when the operation is done (error or null).
