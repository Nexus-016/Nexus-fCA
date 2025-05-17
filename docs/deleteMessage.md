# deleteMessage

Delete one or more messages by ID.

## Usage
```js
api.deleteMessage('mid.$cAA...', (err) => {
  if (err) return console.error(err);
  console.log('Message deleted!');
});
```

## Arguments
- `messageOrMessages`: Message ID or array of message IDs.
- `callback(err)`: Callback called when the operation is done (error or null).
