# changeThreadEmoji

Change the thread emoji.

## Usage
```js
api.changeThreadEmoji('😎', '1234567890', (err) => {
  if (err) return console.error(err);
  console.log('Thread emoji changed!');
});
```

## Arguments
- `emoji`: Emoji character (string).
- `threadID`: Thread ID (string).
- `callback(err)`: Callback called when the operation is done (error or null).
