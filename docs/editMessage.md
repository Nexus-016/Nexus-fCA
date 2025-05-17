# editMessage

Edit a message by ID.

## Usage
```js
api.editMessage('New text', 'mid.$cAA...', (err) => {
  if (err) return console.error(err);
  console.log('Message edited!');
});
```

## Arguments
- `text`: New message text (string).
- `messageID`: Message ID (string).
- `callback(err)`: Callback called when the operation is done (error or null).
