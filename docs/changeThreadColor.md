# changeThreadColor

Change the thread color.

## Usage
```js
api.changeThreadColor('#0000ff', '1234567890', (err) => {
  if (err) return console.error(err);
  console.log('Thread color changed!');
});
```

## Arguments
- `color`: Color hex string (e.g. '#0000ff').
- `threadID`: Thread ID (string).
- `callback(err)`: Callback called when the operation is done (error or null).
